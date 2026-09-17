import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sharoushi_news/services/ai/ai_summary_service.dart';

void main() {
  test('Claude APIのレスポンスからAiSummaryを組み立てる', () async {
    final apiResponse = jsonEncode({
      'content': [
        {
          'type': 'text',
          'text': jsonEncode({
            'summary': 'テスト概要です。',
            'practicalImpact': 'テスト実務影響です。',
            'importantPoints': ['ポイント1', 'ポイント2'],
            'target': '全企業',
          }),
        },
      ],
    });

    final client = MockClient((request) async {
      expect(request.url.toString(), 'https://api.anthropic.com/v1/messages');
      expect(request.headers['x-api-key'], 'test-key');
      return http.Response.bytes(utf8.encode(apiResponse), 200);
    });

    final result = await AiSummaryService(
      apiKey: 'test-key',
      client: client,
    ).summarize(title: 'テスト記事', sourceName: '厚生労働省', categoryLabel: '法改正');

    expect(result.summary, 'テスト概要です。');
    expect(result.practicalImpact, 'テスト実務影響です。');
    expect(result.importantPoints, ['ポイント1', 'ポイント2']);
    expect(result.target, '全企業');
  });

  test('コードブロック記法混じりの応答からもJSONを抽出できる', () async {
    final apiResponse = jsonEncode({
      'content': [
        {
          'type': 'text',
          'text':
              '```json\n${jsonEncode({'summary': 's', 'practicalImpact': 'p', 'importantPoints': [], 'target': 't'})}\n```',
        },
      ],
    });

    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(apiResponse), 200),
    );

    final result = await AiSummaryService(
      apiKey: 'test-key',
      client: client,
    ).summarize(title: 'テスト記事', sourceName: '厚生労働省', categoryLabel: '法改正');

    expect(result.summary, 's');
  });

  test('categoryを含む応答からAiSummary.categoryを組み立てる', () async {
    final apiResponse = jsonEncode({
      'content': [
        {
          'type': 'text',
          'text': jsonEncode({
            'summary': 'テスト概要です。',
            'practicalImpact': 'テスト実務影響です。',
            'importantPoints': ['ポイント1'],
            'target': '全企業',
            'category': 'lawChange',
          }),
        },
      ],
    });

    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(apiResponse), 200),
    );

    final result = await AiSummaryService(
      apiKey: 'test-key',
      client: client,
    ).summarize(title: 'テスト記事', sourceName: '厚生労働省', categoryLabel: '法改正');

    expect(result.category, 'lawChange');
  });

  test('categoryが無い応答ではcategoryはnullになる', () async {
    final apiResponse = jsonEncode({
      'content': [
        {
          'type': 'text',
          'text': jsonEncode({
            'summary': 'テスト概要です。',
            'practicalImpact': 'テスト実務影響です。',
            'importantPoints': <String>[],
            'target': '全企業',
          }),
        },
      ],
    });

    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(apiResponse), 200),
    );

    final result = await AiSummaryService(
      apiKey: 'test-key',
      client: client,
    ).summarize(title: 'テスト記事', sourceName: '厚生労働省', categoryLabel: '法改正');

    expect(result.category, isNull);
  });

  test('bodyTextを渡すとリクエストのプロンプトに本文が含まれる', () async {
    final apiResponse = jsonEncode({
      'content': [
        {
          'type': 'text',
          'text': jsonEncode({
            'summary': 's',
            'practicalImpact': 'p',
            'importantPoints': <String>[],
            'target': 't',
          }),
        },
      ],
    });

    final client = MockClient((request) async {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final messages = body['messages'] as List;
      final prompt = (messages.first as Map<String, dynamic>)['content'] as String;
      expect(prompt, contains('本文抜粋の内容です'));
      return http.Response.bytes(utf8.encode(apiResponse), 200);
    });

    await AiSummaryService(apiKey: 'test-key', client: client).summarize(
      title: 'テスト記事',
      sourceName: '厚生労働省',
      categoryLabel: '法改正',
      bodyText: '本文抜粋の内容です。',
    );
  });

  test('HTTPエラー時は例外を投げる', () async {
    final client = MockClient((request) async => http.Response('', 500));
    expect(
      () => AiSummaryService(
        apiKey: 'test-key',
        client: client,
      ).summarize(title: 'テスト記事', sourceName: '厚生労働省', categoryLabel: '法改正'),
      throwsException,
    );
  });
}
