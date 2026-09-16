// 社労士NEWS の起動確認用スモークテスト。
// ホーム画面のタイトルと、ダミー記事の1件目が表示されることだけを確認する。

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sharoushi_news/main.dart';
import 'package:sharoushi_news/repositories/article_repository.dart';

void main() {
  testWidgets('ホーム画面が起動し、タイトルと記事一覧が表示される', (WidgetTester tester) async {
    await tester.pumpWidget(SharoushiNewsApp(repository: DummyArticleRepository()));
    await tester.pumpAndSettle();

    expect(find.text('社労士NEWS'), findsOneWidget);
    expect(find.byIcon(Icons.newspaper_rounded), findsOneWidget);

    // お気に入りタブへ切り替え
    await tester.tap(find.byIcon(Icons.star_rounded).first);
    await tester.pumpAndSettle();
    expect(find.text('お気に入り'), findsWidgets);

    // 設定タブへ切り替え、免責事項が表示されることを確認
    await tester.tap(find.byIcon(Icons.settings_rounded));
    await tester.pumpAndSettle();
    expect(find.text('このアプリについて'), findsOneWidget);
  });
}
