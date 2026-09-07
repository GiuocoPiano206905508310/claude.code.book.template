import 'package:flutter_test/flutter_test.dart';

import 'package:block_fit_puzzle/main.dart';

void main() {
  testWidgets('Title screen shows PLAY button', (WidgetTester tester) async {
    await tester.pumpWidget(const BlockFitPuzzleApp());
    await tester.pump();

    expect(find.text('PLAY'), findsOneWidget);
    expect(find.textContaining('BLOCK FIT'), findsOneWidget);
  });

  testWidgets('Tapping PLAY navigates to stage select',
      (WidgetTester tester) async {
    await tester.pumpWidget(const BlockFitPuzzleApp());
    await tester.pump();

    await tester.tap(find.text('PLAY'));
    await tester.pumpAndSettle();

    expect(find.text('SELECT STAGE'), findsOneWidget);
  });
}
