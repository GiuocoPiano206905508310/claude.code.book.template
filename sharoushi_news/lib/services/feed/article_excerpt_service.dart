import 'dart:convert';

import 'package:html/parser.dart' as html_parser;
import 'package:http/http.dart' as http;

/// 個別記事ページ本文の冒頭を、AIを使わず単純なHTML解析だけで抜粋する
/// サービス。ANTHROPIC_API_KEY が無い場合の概要欄の代替として使う。
///
/// meta descriptionタグがあればそれを、無ければ最初のまとまった段落
/// （20文字以上の<p>）を抜粋として採用する。RSSは使用せず、通常の
/// HTTP GET+HTMLパースのみを行う。
class ArticleExcerptService {
  ArticleExcerptService({http.Client? client})
    : _client = client ?? http.Client();

  static const _userAgent =
      'SharoushiNewsApp-Prototype/0.1 (individual use; not for redistribution)';
  static const _maxLength = 200;

  // GitHub Actions上での実データ取得で判明した、記事固有の説明文が
  // 設定されていないページで使われる定型のmeta description（機械翻訳
  // ウィジェットの案内文）。個別記事の内容とは無関係なため、これに
  // 一致する場合は候補として採用しない。
  static const _boilerplatePatterns = ['このホームページを、英語・中国語・韓国語へ機械的に自動翻訳します'];

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
        !_isBoilerplate(metaDescription)) {
      return _clean(metaDescription);
    }

    for (final p in document.querySelectorAll('p')) {
      final text = p.text.trim();
      if (text.length >= 20 && !_isBoilerplate(text)) {
        return _clean(text);
      }
    }
    return null;
  }

  bool _isBoilerplate(String text) => isBoilerplate(text);

  /// [text]がサイト共通の定型文（記事内容と無関係）と一致するかどうか。
  /// 過去に取得済みの概要が定型文のままになっている記事を検出し、
  /// 再取得の対象とするために外部からも利用する。
  static bool isBoilerplate(String text) {
    return _boilerplatePatterns.any(text.contains);
  }

  String _clean(String text) {
    final normalized = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    return normalized.length > _maxLength
        ? '${normalized.substring(0, _maxLength)}…'
        : normalized;
  }
}
