import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hero_quest/main.dart';

void main() {
  testWidgets('タイトル画面が表示され、「はじめから」でステージ画面に遷移する', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const HeroQuestApp());
    await tester.pumpAndSettle();

    expect(find.text('Hero Quest'), findsOneWidget);
    expect(find.text('はじめから'), findsOneWidget);

    await tester.tap(find.text('はじめから'));
    // GameWidget内のFlameのゲームループはタイマー駆動のため、
    // 無限には待たずフレームを数回進める。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('はじめから'), findsNothing);
    expect(find.byIcon(Icons.save), findsOneWidget);
  });
}
