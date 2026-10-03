import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/core/utils/official_date.dart';

void main() {
  final now = DateTime(2026, 10, 2);

  DateTime? extract(String body) =>
      extractOfficialDate('<html><body>$body</body></html>', now: now);

  test('日本年金機構の「更新日：YYYY年M月D日」を読み取る', () {
    expect(
      extract('<p>ページID：150010-549-381-068</p><p>更新日：2026年10月1日</p><p>本文</p>'),
      DateTime(2026, 10, 1),
    );
  });

  test('全角数字の和暦（令和）を西暦に変換する', () {
    expect(extract('<p>掲載日：令和８年９月３０日</p>'), DateTime(2026, 9, 30));
    expect(extract('<p>令和元年５月１日公表</p>'), DateTime(2019, 5, 1));
  });

  test('公表・掲載日を更新日より優先する', () {
    expect(
      extract('<p>更新日：2026年10月1日</p><p>掲載日：2026年3月2日</p>'),
      DateTime(2026, 3, 2),
    );
  });

  test('メタタグの公開日を更新日より優先する', () {
    expect(
      extractOfficialDate(
        '<html><head><meta property="article:published_time" content="2026-08-20T09:00:00+09:00">'
        '</head><body><p>更新日：2026年9月1日</p></body></html>',
        now: now,
      ),
      DateTime(2026, 8, 20),
    );
  });

  test('ラベルの無い日付（施行日など）は拾わない', () {
    expect(extract('<p>2026年10月1日から施行されます。</p>'), isNull);
  });

  test('未来の日付・存在しない日付は採用しない', () {
    expect(extract('<p>公表日：2027年4月1日</p>'), isNull);
    expect(extract('<p>公表日：2026年2月30日</p>'), isNull);
  });
}
