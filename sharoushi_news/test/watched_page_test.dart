// WatchedPageParser・WatchedPageTrackerの単体テスト。マークアップは
// GitHub Actions上で実際に取得した「いわゆる『シフト制』について」
// 「労働基準関係リーフレット」のページの構造を簡略化したもの。
import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/services/feed/watched_page_tracker.dart';
import 'package:sharoushi_news/services/parser/watched_page_parser.dart';

const _shiftPage = '''
<html><body>
  <div class="m-breadcrumb"><a href="/stf/seisakunitsuite/index.html">政策について</a></div>
  <main>
    <ul>
      <li><a href="/content/11200000/001749108.pdf">いわゆる「シフト制」により就業する労働者の適切な雇用管理を行うための留意事項（使用者の方等向けリーフレット）［353KB］</a></li>
      <li><a href="/content/11200000/001756191.pdf">「シフト制」で働く場合の年次有給休暇について（使用者の方等向けリーフレット）［756KB］</a></li>
    </ul>
    <table>
      <tr><td>賃金</td><td>最低賃金制度のあらまし</td><td><a href="/content/11200000/001604439.pdf">開く［513KB］</a></td></tr>
      <tr><td>2026年9月28日掲載 <a href="/stf/newpage_70001.html">年次有給休暇の計画的付与について</a></td></tr>
      <tr><td>2026年12月1日施行 <a href="/stf/newpage_70002.html">新しい制度のご案内</a></td></tr>
    </table>
  </main>
  <footer><a href="/stf/sitemap.html">サイトマップ</a></footer>
</body></html>
''';

void main() {
  final parser = WatchedPageParser(now: () => DateTime.utc(2026, 10, 4, 22));
  final links = parser.parse(_shiftPage, 'https://www.mhlw.go.jp/stf/newpage_22954.html');

  test('ファイルサイズ表記を除いたリンク文字列をタイトルにする', () {
    final leaflet = links.firstWhere((l) => l.url.endsWith('001756191.pdf'));
    expect(leaflet.title, '「シフト制」で働く場合の年次有給休暇について（使用者の方等向けリーフレット）');
    expect(leaflet.url, 'https://www.mhlw.go.jp/content/11200000/001756191.pdf');
    expect(leaflet.date, isNull);
  });

  test('「開く」等のリンクは同じ行の文字列をタイトルにする', () {
    final l = links.firstWhere((l) => l.url.endsWith('001604439.pdf'));
    expect(l.title, '賃金 最低賃金制度のあらまし');
  });

  test('同じ行の掲載日を使い、未来の日付（施行日等）は使わない', () {
    expect(links.firstWhere((l) => l.url.endsWith('70001.html')).date, DateTime(2026, 9, 28));
    expect(links.firstWhere((l) => l.url.endsWith('70002.html')).date, isNull);
  });

  test('パンくず・フッターのリンクは対象外', () {
    expect(links.any((l) => l.url.endsWith('index.html') || l.url.endsWith('sitemap.html')), isFalse);
  });

  group('WatchedPageTracker', () {
    const page = 'https://www.mhlw.go.jp/stf/newpage_22954.html';
    final today = DateTime(2026, 10, 5);
    WatchedLink link(String url, [DateTime? date]) =>
        WatchedLink(url: url, title: 'title $url', date: date);

    test('初めて監視するページは既存のリンクを記事にしない', () {
      final tracker = WatchedPageTracker.fromJson(null, today: today);
      expect(tracker.record(page, [link('a.pdf'), link('b.pdf')]), isEmpty);
      expect(tracker.recent, isEmpty);
    });

    test('前回から増えたリンクだけを記事にし、状態を引き継ぐ', () {
      final first = WatchedPageTracker.fromJson(null, today: today)
        ..record(page, [link('a.pdf')]);
      final second = WatchedPageTracker.fromJson(
        first.toJson().cast<String, dynamic>(),
        today: today,
      );
      final found = second.record(page, [link('a.pdf'), link('b.pdf'), link('c.html', DateTime(2026, 10, 2))]);

      expect(found.map((d) => d.url), ['b.pdf', 'c.html']);
      expect(found[0].publishedAt, today);
      expect(found[0].datedOnPage, isFalse);
      expect(found[1].publishedAt, DateTime(2026, 10, 2));

      // 次回の実行でも検出済みの記事は残り、再検出はされない。
      final third = WatchedPageTracker.fromJson(
        _roundTrip(second.toJson()),
        today: today.add(const Duration(days: 1)),
      );
      expect(third.record(page, [link('a.pdf'), link('b.pdf'), link('c.html')]), isEmpty);
      expect(third.recent.map((d) => d.url), ['b.pdf', 'c.html']);
    });

    test('一度に大量に増えた場合はページの改装とみなし記事にしない', () {
      final tracker = WatchedPageTracker.fromJson(null, today: today)..record(page, [link('a.pdf')]);
      final many = [for (var i = 0; i < WatchedPageTracker.maxNewLinksPerPage + 1; i++) link('n$i.pdf')];
      expect(tracker.record(page, many), isEmpty);
      expect(tracker.record(page, [...many, link('z.pdf')]).map((d) => d.url), ['z.pdf']);
    });

    test('取得できたリンクが0件（エラーページ等）の場合は何もしない', () {
      final tracker = WatchedPageTracker.fromJson(null, today: today)..record(page, [link('a.pdf')]);
      expect(tracker.record(page, const []), isEmpty);
      expect(tracker.record(page, [link('a.pdf')]), isEmpty);
    });
  });
}

Map<String, dynamic> _roundTrip(Map<String, Object?> json) => {
  'pages': json['pages'],
  'discovered': [for (final d in json['discovered']! as List) (d as Map).cast<String, dynamic>()],
};
