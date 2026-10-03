// RoudoukyokuParserの単体テスト。マークアップはGitHub Actions上で実際の
// 北海道労働局のページを取得して確認した構造を簡略化したもの。
import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/services/parser/roudoukyoku_parser.dart';

const _topPage = '''
<html><body>
  <header><ul class="m-headerMdrop__menu">
    <li><a href="/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin.html">各種助成金制度</a></li>
  </ul></header>
  <ul class="m-listNews">
    <li><a href="/hokkaido-roudoukyoku/newpage_01105.html">2026年10月01日 北海道特定最低賃金引上げの答申がまとまりました NEW</a></li>
    <li><a href="/hokkaido-roudoukyoku/newpage_00972.html">2026年09月01日 令和8年度業務改善助成金の受付を開始します</a></li>
  </ul>
  <ul class="m-listBanner"><li><a href="https://www.soumu.go.jp/teleworkgekkan/">テレワーク月間</a></li></ul>
</body></html>
''';

const _subsidyPage = '''
<html><body>
  <h2>新着情報</h2>
  <table>
    <tr><td>2026年10月1日</td><td><a href="/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin/h30career-up.html">キャリアアップ助成金における申立書(様式)を公表しました。</a></td></tr>
    <tr><td>2026年9月14日</td><td><a href="/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin/career-up2.html">令和8年10月1日より正社員化コースの審査において支給要領0207ホの要件を確認できない場合は申立書（様式）をご提出いただきます</a></td></tr>
    <tr><td>2026年5月14日</td><td><a href="/hokkaido-roudoukyoku/content/contents/002727781.docx">疎明書（様式第28号）</a></td></tr>
  </table>
  <p><a href="/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin/_120626.html">全てのお知らせはこちら</a></p>
</body></html>
''';

// 実サイトの診断で見つかった誤検出パターン（佐賀・岡山・北海道・奈良・山形）。
const _pitfalls = '''
<html><body>
  <table>
    <tr><td><a href="/saga-roudoukyoku/a.html">働き方改革推進支援助成金（団体推進コース）</a></td><td>2026年11月30日</td></tr>
  </table>
  <ul>
    <li><a href="/okayama-roudoukyoku/b.html">令和8年6月29日（月）から岡山労働局助成金センターを開設します！</a></li>
    <li><a href="/hokkaido-roudoukyoku/c.html">令和8年5月1日以降の紹介より、特定求職者雇用開発助成金の要件が見直されます</a></li>
    <li><a href="/okayama-roudoukyoku/d.html">2026年01月20日 詳細はこちら</a></li>
    <li><a href="/okayama-roudoukyoku/e.html">2026年10月02日 最低賃金の詳細</a></li>
  </ul>
  <p>令和8年10月1日更新<br>
    <a href="/yamagata-roudoukyoku/f.html">キャリアアップ助成金チェックリストを更新しました</a><br>
    <a href="/yamagata-roudoukyoku/g.html">雇用関係助成金を電子申請すると審査期間の短縮につながります</a><br>
    <a href="/yamagata-roudoukyoku/h.html">人材開発支援助成金資料を追加しました</a>
  </p>
  <ul><li><a href="/hokkaido-roudoukyoku/i.html">2026年10月03日 業務改善助成金の受付を延長します</a></li></ul>
</body></html>
''';

void main() {
  // テストの基準日は日本時間の2026年10月3日。
  final parser = RoudoukyokuParser(now: () => DateTime.utc(2026, 10, 2, 22));

  test('トップページ: リンク先頭の日付を公表日として切り出し、末尾のNEWを除く', () {
    final c = parser.parse(_topPage, 'https://jsite.mhlw.go.jp/hokkaido-roudoukyoku/');

    expect(c.map((e) => e.title), [
      '北海道特定最低賃金引上げの答申がまとまりました',
      '令和8年度業務改善助成金の受付を開始します',
    ]);
    expect(c.first.publishedAt, DateTime(2026, 10, 1));
    expect(c.first.url, 'https://jsite.mhlw.go.jp/hokkaido-roudoukyoku/newpage_01105.html');
  });

  test('助成金ページ: 表の別セルの日付を使い、タイトル中の日付は公表日にしない', () {
    final c = parser.parse(
      _subsidyPage,
      'https://jsite.mhlw.go.jp/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin.html',
    );

    expect(c, hasLength(2));
    expect(c[0].publishedAt, DateTime(2026, 10, 1));
    expect(c[1].title, startsWith('令和8年10月1日より正社員化コース'));
    expect(c[1].publishedAt, DateTime(2026, 9, 14));
  });

  test('メニュー・バナー・日付の無いリンク・Word等のファイルは対象外', () {
    final urls = [
      ...parser.parse(_topPage, 'https://jsite.mhlw.go.jp/hokkaido-roudoukyoku/'),
      ...parser.parse(
        _subsidyPage,
        'https://jsite.mhlw.go.jp/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin.html',
      ),
    ].map((e) => e.url);

    expect(urls.any((u) => u.endsWith('joseikin.html')), isFalse);
    expect(urls.any((u) => u.contains('soumu.go.jp')), isFalse);
    expect(urls.any((u) => u.endsWith('.docx')), isFalse);
    expect(urls.any((u) => u.endsWith('_120626.html')), isFalse);
  });

  test('未来の日付・文中の日付・内容の分からないリンク・まとめ段落の日付は除外', () {
    final c = parser.parse(_pitfalls, 'https://jsite.mhlw.go.jp/x-roudoukyoku/');

    // 日本時間の今日（UTCでは前日）の記事だけが残る。
    expect(c.map((e) => e.title), ['業務改善助成金の受付を延長します']);
    expect(c.single.publishedAt, DateTime(2026, 10, 3));
  });
}
