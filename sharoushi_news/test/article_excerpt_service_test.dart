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

  // 実際のGitHub Actions上での取得結果、記事固有のmeta descriptionが
  // 設定されていないMHLWのページでは、機械翻訳ウィジェットの定型案内文が
  // meta descriptionとして返ってくることが分かった（記事内容とは無関係）。
  test('機械翻訳ウィジェットの定型meta descriptionは採用せず本文段落を使う', () async {
    const html = '''
<html><head>
<meta name="description" content="このホームページを、英語・中国語・韓国語へ機械的に自動翻訳します。以下の内容をご理解のうえ、ご利用いただきますようお願いします。">
</head><body><p>これは実際の記事本文の最初の段落です。テスト用のダミーテキストになります。</p></body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, 'これは実際の記事本文の最初の段落です。テスト用のダミーテキストになります。');
  });

  test('本文段落も定型文しか無ければnullを返す', () async {
    const html = '''
<html><body>
<p>このホームページを、英語・中国語・韓国語へ機械的に自動翻訳します。以下の内容をご理解のうえ、ご利用いただきますようお願いします。</p>
</body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, isNull);
  });

  // 実際のGitHub Actions上での取得結果、記事本文の後にある「お問い合わせ先」
  // ブロック（部署名・電話番号・ページID）を最初の段落として拾ってしまう
  // ことが分かった。これらは記事内容ではないため除外する。
  test('お問い合わせ先ブロック（電話番号・ページID）は採用せず本文段落を使う', () async {
    const html = '''
<html><body>
<p>これは実際の記事本文の最初の段落です。テスト用のダミーテキストになります。</p>
<p>健康・生活衛生局難病対策課 (代表電話) 03(5253)1111 (直通電話) 03(3595)2251</p>
<p>ページID：150020010-196-269-822</p>
</body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

    final excerpt = await ArticleExcerptService(client: client)
        .fetchExcerpt('https://example.com/a.html');

    expect(excerpt, 'これは実際の記事本文の最初の段落です。テスト用のダミーテキストになります。');
  });

  test('Adobe Readerの定型案内文は採用しない', () async {
    const html = '''
<html><body>
<p>PDFファイルを見るためには、Adobe Readerというソフトが必要です。Adobe Readerは無料で配布されていますので、こちらからダウンロードしてください。</p>
</body></html>
''';
    final client = MockClient(
      (request) async => http.Response.bytes(utf8.encode(html), 200),
    );

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
