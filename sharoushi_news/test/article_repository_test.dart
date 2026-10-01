import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sharoushi_news/repositories/article_repository.dart';
import 'package:sharoushi_news/services/feed/daily_feed_service.dart';

void main() {
  test('refreshFromDailyFeedはフィードの内容に一覧を置き換える（初期シードは消える）', () async {
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
    expect(repository.articles, isNotEmpty); // 初期シードデータがある状態

    await repository.refreshFromDailyFeed();

    // フィードに無い初期シードデータは一覧から無くなり、フィードの内容のみになる。
    expect(repository.articles.length, 1);
    expect(
      repository.articles.single.canonicalUrl,
      'https://www.mhlw.go.jp/example/new-daily-article.html',
    );

    // 同じ内容を再度取得しても件数は変わらない。
    await repository.refreshFromDailyFeed();
    expect(repository.articles.length, 1);
  });

  test('refreshFromDailyFeedは既存記事のお気に入り・既読状態を引き継ぐ', () async {
    const url = 'https://www.mhlw.go.jp/example/kept-article.html';
    Future<http.Response> respond(http.Request request) async => http.Response.bytes(
      utf8.encode(
        jsonEncode([
          {
            'id': url,
            'title': 'テスト記事',
            'sourceName': '厚生労働省',
            'sourceUrl': 'https://www.mhlw.go.jp/',
            'canonicalUrl': url,
            'publishedAt': '2026-09-20T00:00:00.000',
            'fetchedAt': '2026-09-20T06:00:00.000',
            'category': 'lawChange',
            'summary': 'テスト用の概要。',
            'practicalImpact': 'テスト用の実務影響。',
            'target': '原文をご確認ください。',
            'importance': 1,
          },
        ]),
      ),
      200,
    );
    final client = MockClient(respond);
    final repository = DummyArticleRepository(
      feedService: DailyFeedService(client: client),
    );

    await repository.refreshFromDailyFeed();
    await repository.toggleFavorite(url);
    await repository.markAsRead(url);

    await repository.refreshFromDailyFeed();

    final article = repository.articles.single;
    expect(article.isFavorite, isTrue);
    expect(article.isRead, isTrue);
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
