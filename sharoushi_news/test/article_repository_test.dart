import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sharoushi_news/repositories/article_repository.dart';
import 'package:sharoushi_news/services/feed/daily_feed_service.dart';

void main() {
  test('refreshFromDailyFeedは未取得の記事だけを追加する', () async {
    final sampleJson = jsonEncode([
      {
        'id': 'https://www.mhlw.go.jp/example/new-daily-article.html',
        'title': '新着：デイリーフィードのテスト記事',
        'sourceName': '厚生労働省',
        'sourceUrl': 'https://www.mhlw.go.jp/',
        'canonicalUrl': 'https://www.mhlw.go.jp/example/new-daily-article.html',
        'publishedAt': '2026-09-20T00:00:00.000',
        'fetchedAt': '2026-09-20T06:00:00.000',
        'category': 'lawChange',
        'summary': 'テスト用の概要。',
        'practicalImpact': 'テスト用の実務影響。',
        'target': '原文をご確認ください。',
        'importance': 1,
      },
    ]);
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(sampleJson), 200),
    );
    final repository = DummyArticleRepository(
      feedService: DailyFeedService(client: client),
    );
    final beforeCount = repository.articles.length;

    await repository.refreshFromDailyFeed();

    expect(repository.articles.length, beforeCount + 1);
    expect(
      repository.articles.any(
        (a) =>
            a.canonicalUrl ==
            'https://www.mhlw.go.jp/example/new-daily-article.html',
      ),
      isTrue,
    );

    // 同じ記事を再度取得しても重複追加されない。
    await repository.refreshFromDailyFeed();
    expect(repository.articles.length, beforeCount + 1);
  });

  test('取得に失敗しても既存の記事はそのまま維持される', () async {
    final client = MockClient((request) async => http.Response('', 500));
    final repository = DummyArticleRepository(
      feedService: DailyFeedService(client: client),
    );
    final before = repository.articles.length;

    await repository.refreshFromDailyFeed();

    expect(repository.articles.length, before);
  });
}
