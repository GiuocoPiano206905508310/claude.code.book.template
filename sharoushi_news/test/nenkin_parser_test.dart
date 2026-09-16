// NenkinParser の単体テスト。
//
// 注意: このサンドボックス環境からは実際の日本年金機構サイトのHTMLを取得
// できないため、ユーザーから共有された実リンク1件
// （/oshirase/taisetu/kojin/2026/202604/0401.html）から推測した
// マークアップでテストしている。
import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/services/parser/nenkin_parser.dart';

const _sampleHtml = '''
<html><body>
  <ul class="oshirase-list">
    <li><a href="/oshirase/taisetu/kojin/2026/202604/0401.html">令和8年度の年金額改定について</a></li>
    <li><a href="/oshirase/taisetu/jigyosho/2026/202607/0701.html">算定基礎届の提出について</a></li>
    <li><a href="/service/kounen/index.html">厚生年金保険制度の案内</a></li>
  </ul>
</body></html>
''';

void main() {
  test('記事リンクを抽出し、URLパスから日付を復元する', () {
    final candidates = NenkinParser().parse(
      _sampleHtml,
      'https://www.nenkin.go.jp/oshirase/taisetu/kojin/2026/index.html',
    );

    expect(candidates, hasLength(2));

    expect(candidates[0].title, '令和8年度の年金額改定について');
    expect(
      candidates[0].url,
      'https://www.nenkin.go.jp/oshirase/taisetu/kojin/2026/202604/0401.html',
    );
    expect(candidates[0].publishedAt, DateTime(2026, 4, 1));

    expect(candidates[1].publishedAt, DateTime(2026, 7, 1));

    // パターンに合わない一般ページ（制度案内等）は除外される。
    expect(candidates.any((c) => c.url.endsWith('kounen/index.html')), isFalse);
  });
}
