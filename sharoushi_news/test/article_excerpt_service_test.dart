import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sharoushi_news/services/feed/article_excerpt_service.dart';

void main() {
  test('meta descriptionがあればそれを抜粋として使う', () async {
    const html = '''
<html><head>
<meta name="description" content="これはmeta descriptionの内容です。">
</head><body><p>本文の段落です。</p></body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, 'これはmeta descriptionの内容です。');
  });

  test('meta descriptionが無ければ最初のまとまった段落を使う', () async {
    const html = '''
<html><body>
<p>短い</p>
<p>これは十分な長さのある最初の本文段落です。テスト用のダミーテキストになります。</p>
</body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, 'これは十分な長さのある最初の本文段落です。テスト用のダミーテキストになります。');
  });

  test('該当する要素が無ければnullを返す', () async {
    const html = '<html><body><p>短い</p></body></html>';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, isNull);
  });

  test('HTTPエラー時はnullを返す', () async {
    final client = MockClient((request) async => http.Response('', 500));

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, isNull);
  });

  test('長い抜粋は200文字で切り詰める', () async {
    final longText = 'あ' * 300;
    final html = '<html><body><p>$longText</p></body></html>';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, hasLength(201));
    expect(excerpt, endsWith('…'));
  });
}
