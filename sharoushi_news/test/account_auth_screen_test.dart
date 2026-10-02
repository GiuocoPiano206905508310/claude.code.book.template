import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sharoushi_news/core/constants/terms_of_service.dart';
import 'package:sharoushi_news/features/account/account_auth_screen.dart';
import 'package:sharoushi_news/repositories/article_repository.dart';
import 'package:sharoushi_news/services/auth/account_controller.dart';
import 'package:sharoushi_news/services/auth/auth_service.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  FilledButton agreeButton(WidgetTester tester) => tester.widget<FilledButton>(
    find.widgetWithText(FilledButton, '同意する'),
  );

  testWidgets('利用規約の全条にチェックを入れるまで「同意する」は押せない', (tester) async {
    final controller = AccountController(
      authService: AuthService(),
      repository: DummyArticleRepository(),
    );
    await tester.pumpWidget(MaterialApp(home: AccountAuthScreen(controller: controller)));
    await tester.tap(find.text('新規登録'));
    await tester.pumpAndSettle();

    expect(find.text('同意しない'), findsOneWidget);
    expect(agreeButton(tester).onPressed, isNull);

    final checkboxes = find.byType(Checkbox);
    expect(checkboxes, findsNWidgets(termsOfService.length));

    for (var i = 0; i < termsOfService.length; i++) {
      await tester.ensureVisible(checkboxes.at(i));
      await tester.tap(checkboxes.at(i));
      await tester.pump();
      final allChecked = i == termsOfService.length - 1;
      expect(agreeButton(tester).onPressed, allChecked ? isNotNull : isNull);
    }

    // 1つでも外すと再び押せなくなる。
    await tester.ensureVisible(checkboxes.first);
    await tester.tap(checkboxes.first);
    await tester.pump();
    expect(agreeButton(tester).onPressed, isNull);
  });
}
