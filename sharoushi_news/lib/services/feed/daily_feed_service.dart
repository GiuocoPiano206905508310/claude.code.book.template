import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/utils/text_sanitizer.dart';
import '../../models/article.dart';

/// GitHub Actions上で1日1回、MhlwParser／NenkinParser（RSS不使用）を
/// 実際のサイトに対して動かして生成された記事一覧（JSON）を取得するサービス。
///
/// アプリ自身がMHLW・日本年金機構へ直接アクセスするのではなく、事前に
/// GitHub Pages上へ公開された結果を読みに行くだけなので、Web版でも
/// ブラウザのCORS制限に引っかからず動作する。
class DailyFeedService {
  DailyFeedService({http.Client? client}) : _client = client ?? http.Client();

  static const feedUrl =
      'https://giuocopiano206905508310.github.io/claude.code.book.template/sharoushi-news-feed/articles.json';

  final http.Client _client;

  Future<List<Article>> fetchDailyFeed() async {
    final response = await _client
        .get(Uri.parse(feedUrl))
        .timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) {
      throw Exception('日次フィードの取得に失敗しました: HTTP ${response.statusCode}');
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes)) as List;
    return decoded
        .map((e) => _articleFromJson(e as Map<String, dynamic>))
        .toList();
  }

  Article _articleFromJson(Map<String, dynamic> json) {
    final category = NewsCategory.values.firstWhere(
      (c) => c.name == json['category'],
      orElse: () => NewsCategory.lawChange,
    );
    return Article(
      id: json['id'] as String,
      title: sanitizeScrapedText(json['title'] as String),
      sourceName: sanitizeScrapedText(json['sourceName'] as String),
      sourceUrl: json['sourceUrl'] as String,
      canonicalUrl: json['canonicalUrl'] as String,
      publishedAt: DateTime.parse(json['publishedAt'] as String),
      fetchedAt: DateTime.parse(json['fetchedAt'] as String),
      category: category,
      summary: sanitizeScrapedText(json['summary'] as String),
      practicalImpact: sanitizeScrapedText(json['practicalImpact'] as String),
      importantPoints: sanitizeScrapedTextList(
        (json['importantPoints'] as List?)?.map((e) => e as String).toList() ??
            const [],
      ),
      target: sanitizeScrapedText(json['target'] as String),
      importance: json['importance'] as int? ?? 1,
      contentHash: json['id'] as String,
      isAiGenerated: json['isAiGenerated'] as bool? ?? false,
    );
  }
}
