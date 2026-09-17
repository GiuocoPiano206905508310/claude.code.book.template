import 'dart:convert';

import 'package:html/parser.dart' as html_parser;
import 'package:http/http.dart' as http;

import '../../core/utils/text_sanitizer.dart';

/// 個別記事ページ本文を、AIを使わず単純なHTML解析だけで取得するサービス。
///
/// [fetchExcerpt]はmeta descriptionタグがあればそれを、無ければ最初の
/// まとまった段落（20文字以上の<p>）を抜粋として採用し、
/// ANTHROPIC_API_KEY が無い場合の概要欄の代替として使う。
/// [fetchBodyText]はAI要約にタイトルだけでなく実際の本文を渡して、より
/// 詳しく正確な要約を生成できるようにするための、複数段落を集めた
/// 本文テキストを返す。RSSは使用せず、通常のHTTP GET+HTMLパースのみを行う。
class ArticleExcerptService {
  ArticleExcerptService({http.Client? client})
    : _client = client ?? http.Client();

  static const _userAgent =
      'SharoushiNewsApp-Prototype/0.1 (individual use; not for redistribution)';
  static const _maxLength = 200;

  // GitHub Actions上での実データ取得で判明した、記事内容とは無関係な
  // サイト共通の定型文・案内文。これらに一致する場合は候補として
  // 採用しない。
  static const _boilerplatePatterns = [
    'このホームページを、英語・中国語・韓国語へ機械的に自動翻訳します',
    'PDFファイルを見るためには、Adobe Readerというソフトが必要です',
  ];

  // MHLWの多くのページ末尾にある「お問い合わせ先」ブロック
  // （部署名・担当者名・電話番号・ページIDなど）を検出するための
  // パターン。記事本文ではなく事務的な付随情報のため、候補として
  // 採用しない。
  static final _contactBlockPatterns = [
    RegExp('代表電話'),
    RegExp('直通電話'),
    RegExp('ページID[：:]'),
  ];

  final http.Client _client;

  /// 抜粋の取得に失敗した場合（ネットワークエラー・該当要素なし等）はnullを返す。
  Future<String?> fetchExcerpt(String url) async {
    final http.Response response;
    try {
      response = await _client
          .get(Uri.parse(url), headers: const {'User-Agent': _userAgent})
          .timeout(const Duration(seconds: 15));
    } catch (_) {
      return null;
    }
    if (response.statusCode != 200) return null;

    final document = html_parser.parse(utf8.decode(response.bodyBytes));

    final metaDescription =
        document
            .querySelector('meta[name="description"]')
            ?.attributes['content'] ??
        document
            .querySelector('meta[property="og:description"]')
            ?.attributes['content'];
    if (metaDescription != null &&
        metaDescription.trim().isNotEmpty &&
        !isLowQualityExcerpt(metaDescription)) {
      return _clean(metaDescription);
    }

    for (final p in document.querySelectorAll('p')) {
      final text = p.text.trim();
      if (text.length >= 20 && !isLowQualityExcerpt(text)) {
        return _clean(text);
      }
    }
    return null;
  }

  /// AI要約のグラウンディング用に、記事ページの本文段落を複数まとめて
  /// 返す（[fetchExcerpt]と違い先頭1件だけでなく、定型文を除いた段落を
  /// [maxLength]文字に達するまで集める）。取得できない場合はnullを返す。
  Future<String?> fetchBodyText(String url, {int maxLength = 3000}) async {
    final http.Response response;
    try {
      response = await _client
          .get(Uri.parse(url), headers: const {'User-Agent': _userAgent})
          .timeout(const Duration(seconds: 15));
    } catch (_) {
      return null;
    }
    if (response.statusCode != 200) return null;

    final document = html_parser.parse(utf8.decode(response.bodyBytes));
    final buffer = StringBuffer();
    for (final el in document.querySelectorAll('p, li')) {
      final text = sanitizeScrapedText(el.text.trim());
      if (text.length < 10 || isLowQualityExcerpt(text)) continue;
      if (buffer.isNotEmpty) buffer.write('\n');
      buffer.write(text);
      if (buffer.length >= maxLength) break;
    }
    if (buffer.isEmpty) return null;
    final result = buffer.toString();
    return result.length > maxLength ? result.substring(0, maxLength) : result;
  }

  /// [text]が、記事内容と無関係なサイト共通の定型文・案内文、または
  /// 「お問い合わせ先」ブロック（部署名・電話番号・ページIDなど）と
  /// 一致するかどうか。過去に取得済みの概要がこれらのままになっている
  /// 記事を検出し、再取得の対象とするために外部からも利用する。
  static bool isLowQualityExcerpt(String text) {
    return _boilerplatePatterns.any(text.contains) ||
        _contactBlockPatterns.any((p) => p.hasMatch(text));
  }

  String _clean(String text) {
    final normalized = sanitizeScrapedText(
      text,
    ).replaceAll(RegExp(r'\s+'), ' ').trim();
    return normalized.length > _maxLength
        ? '${normalized.substring(0, _maxLength)}…'
        : normalized;
  }
}
