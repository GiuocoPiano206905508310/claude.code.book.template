import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sharoushi_news/models/article.dart';
import 'package:sharoushi_news/services/feed/daily_feed_service.dart';

void main() {
  test('JSONフィードを取得し、Articleのリストへ変換する', () async {
    final sampleJson = jsonEncode([
      {
        'id': 'https://www.nenkin.go.jp/example/0916.html',
        'title': '日本国籍を有しない方のフリガナ氏名の取り扱いについて',
        'sourceName': '日本年金機構',
        'sourceUrl': 'https://www.nenkin.go.jp/',
        'canonicalUrl': 'https://www.nenkin.go.jp/example/0916.html',
        'publishedAt': '2026-09-16T00:00:00.000',
        'fetchedAt': '2026-09-16T06:00:00.000',
        'category': 'socialInsurance',
        'summary': 'この記事はタイトルのみ自動取得されています。',
        'practicalImpact': '実務への影響は原文をご確認ください。',
        'target': '原文をご確認ください。',
        'importance': 1,
      },
    ]);

    final client = MockClient((request) async {
      expect(request.url.toString(), DailyFeedService.feedUrl);
      return http.Response.bytes(utf8.encode(sampleJson), 200);
    });

    final articles = await DailyFeedService(client: client).fetchDailyFeed();

    expect(articles, hasLength(1));
    expect(articles.first.title, '日本国籍を有しない方のフリガナ氏名の取り扱いについて');
    expect(
      articles.first.canonicalUrl,
      'https://www.nenkin.go.jp/example/0916.html',
    );
    expect(articles.first.category, NewsCategory.socialInsurance);
    expect(articles.first.isAiGenerated, isFalse);
  });

  test('HTTPエラー時は例外を投げる', () async {
    final client = MockClient((request) async => http.Response('', 500));
    expect(
      () => DailyFeedService(client: client).fetchDailyFeed(),
      throwsException,
    );
  });
}
