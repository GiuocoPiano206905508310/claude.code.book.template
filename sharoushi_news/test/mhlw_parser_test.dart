// MhlwParser の単体テスト。
//
// 注意: このサンドボックス環境からは実際の厚労省サイトのHTMLを取得できない
// ため、ユーザーから共有されたスクリーンショット・実リンクを参考に組んだ
// 「推測上のマークアップ」でテストしている。実機で本物のページに対して
// 動作確認した際、構造が異なっていればこのテストごと調整すること。
import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';

const _sampleHtml = '''
<html><body>
  <div class="new-info-list">
    <h2>2026年9月15日（火）掲載</h2>
    <ul>
      <li>
        <span class="tag">大臣会見等</span>
        <a href="/stf/kaiken/daijin/0000194708_00968.html">令和８年９月１５日付大臣会見概要</a>
        <span class="new">NEW</span>
      </li>
      <li>
        <span class="tag">報道発表</span>
        <a href="/stf/newpage_76212.html">第１２５回コーデックス連絡協議会（開催案内）</a>
        <span class="new">NEW</span>
      </li>
    </ul>
    <h2>2026年9月14日（月）掲載</h2>
    <ul>
      <li>
        <span class="tag">大臣会見等</span>
        <a href="/stf/kaiken/daijin/0000194708_00967.html">令和８年９月１４日付大臣会見概要</a>
      </li>
    </ul>
  </div>
  <footer><a href="/">ホーム</a></footer>
</body></html>
''';

void main() {
  test('記事リンクを抽出し、絶対URLと日付を推定する', () {
    final candidates = MhlwParser().parse(_sampleHtml, 'https://www.mhlw.go.jp/stf/new-info/');

    expect(candidates, hasLength(3));

    expect(candidates[0].title, '令和８年９月１５日付大臣会見概要');
    expect(candidates[0].url, 'https://www.mhlw.go.jp/stf/kaiken/daijin/0000194708_00968.html');

    expect(candidates[1].url, 'https://www.mhlw.go.jp/stf/newpage_76212.html');

    // フッターの「ホーム」リンクなど、記事URLパターンに合わないリンクは除外される。
    expect(candidates.any((c) => c.url.endsWith('mhlw.go.jp/')), isFalse);
  });

  test('見出しの日付を各記事に紐付ける', () {
    final candidates = MhlwParser().parse(_sampleHtml, 'https://www.mhlw.go.jp/stf/new-info/');

    expect(candidates[0].publishedAt, DateTime(2026, 9, 15));
    expect(candidates[1].publishedAt, DateTime(2026, 9, 15));
    expect(candidates[2].publishedAt, DateTime(2026, 9, 14));
  });
}
