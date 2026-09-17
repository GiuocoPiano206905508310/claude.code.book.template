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
    final candidates = MhlwParser().parse(
      _sampleHtml,
      'https://www.mhlw.go.jp/stf/new-info/',
    );

    expect(candidates, hasLength(3));

    expect(candidates[0].title, '令和８年９月１５日付大臣会見概要');
    expect(
      candidates[0].url,
      'https://www.mhlw.go.jp/stf/kaiken/daijin/0000194708_00968.html',
    );

    expect(candidates[1].url, 'https://www.mhlw.go.jp/stf/newpage_76212.html');

    // フッターの「ホーム」リンクなど、記事URLパターンに合わないリンクは除外される。
    expect(candidates.any((c) => c.url.endsWith('mhlw.go.jp/')), isFalse);
  });

  test('見出しの日付を各記事に紐付ける', () {
    final candidates = MhlwParser().parse(
      _sampleHtml,
      'https://www.mhlw.go.jp/stf/new-info/',
    );

    expect(candidates[0].publishedAt, DateTime(2026, 9, 15));
    expect(candidates[1].publishedAt, DateTime(2026, 9, 15));
    expect(candidates[2].publishedAt, DateTime(2026, 9, 14));
  });

  // 実際の厚労省サイト（分野別トピックス一覧ページ）を検証したところ、日付は
  // 見出しではなく各リンクの文字列自体の先頭に埋め込まれていた
  // （例:「2012年5月9日掲載\n年度更新申告書...」）。また、日付を持たない
  // 案内リンク（サイドバー等）も混在していたため、日付が取れないリンクは
  // 誤検出として除外する仕様にした。
  const bunyaHtml = '''
<html><body>
  <ul class="topics-list">
    <li><a href="/stf/seisakunitsuite/bunya/0000017154.html">2012年5月9日掲載
平成24年度全国労働衛生週間のスローガン募集について</a></li>
    <li><a href="/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/kurumin/index.html">くるみんマークについて</a></li>
  </ul>
</body></html>
''';

  test('リンク先頭に埋め込まれた日付をタイトルから分離する', () {
    final candidates = MhlwParser().parse(
      bunyaHtml,
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150858_161_162.html',
    );

    expect(candidates, hasLength(1));
    expect(candidates[0].title, '平成24年度全国労働衛生週間のスローガン募集について');
    expect(candidates[0].publishedAt, DateTime(2012, 5, 9));
  });

  test('日付が特定できない案内リンクは除外する', () {
    final candidates = MhlwParser().parse(
      bunyaHtml,
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150858_161_162.html',
    );

    expect(candidates.any((c) => c.title == 'くるみんマークについて'), isFalse);
  });

  // 実際のGitHub Actions上での取得結果、新着情報ページ（/stf/new-info/）では
  // カテゴリーラベル・タイトル・「NEW」バッジが<a>タグ内の別々のテキスト
  // ノードとして混在しており、素朴にanchor.textを取ると
  // 「審議会等\n\n第25回...資料\nNEW」のようにタイトルが汚染される不具合があった。
  const newInfoWithNoiseHtml = '''
<html><body>
  <h2>2026年9月16日掲載</h2>
  <ul>
    <li>
      <a href="/stf/newpage_76266.html">
        <span class="tag">審議会等</span>

        第25回　医薬品等行政評価・監視委員会資料
        <span class="new">NEW</span>
      </a>
    </li>
    <li>
      <a href="/stf/newpage_76038.html">
        <span class="tag">その他</span>

        令和８年民間主要企業夏季一時金妥結状況を公表します
      </a>
    </li>
  </ul>
</body></html>
''';

  test('カテゴリーラベルやNEWバッジが混入したタイトルをクリーンアップする', () {
    final candidates = MhlwParser().parse(
      newInfoWithNoiseHtml,
      'https://www.mhlw.go.jp/stf/new-info/',
    );

    expect(candidates, hasLength(2));
    expect(candidates[0].title, '第25回　医薬品等行政評価・監視委員会資料');
    expect(candidates[1].title, '令和８年民間主要企業夏季一時金妥結状況を公表します');
  });
}
