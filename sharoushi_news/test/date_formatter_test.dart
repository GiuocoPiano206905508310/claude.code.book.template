import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/core/utils/date_formatter.dart';

void main() {
  group('isWithinNewWindow', () {
    final now = DateTime(2026, 10, 15);

    test('30日以内に公開・更新された記事はtrue', () {
      expect(isWithinNewWindow(DateTime(2026, 10, 1), now: now), isTrue);
      expect(isWithinNewWindow(now, now: now), isTrue);
    });

    test('30日より前に公開・更新された記事はfalse', () {
      expect(isWithinNewWindow(DateTime(2026, 9, 1), now: now), isFalse);
    });

    test('境界値（ちょうど30日前）はtrue', () {
      final exactlyThirtyDaysAgo = now.subtract(const Duration(days: 30));
      expect(isWithinNewWindow(exactlyThirtyDaysAgo, now: now), isTrue);
    });
  });
}
