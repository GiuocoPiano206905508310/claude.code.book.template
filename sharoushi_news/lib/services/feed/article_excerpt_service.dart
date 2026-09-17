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
    if (metaDescription != null && metaDescription.trim().isNotEmpty) {
      return _clean(metaDescription);
    }

    for (final p in document.querySelectorAll('p')) {
      final text = p.text.trim();
      if (text.length >= 20) {
        return _clean(text);
      }
    }
    return null;
  }

  String _clean(String text) {
    final normalized = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    return normalized.length > _maxLength
        ? '${normalized.substring(0, _maxLength)}…'
        : normalized;
  }
}
