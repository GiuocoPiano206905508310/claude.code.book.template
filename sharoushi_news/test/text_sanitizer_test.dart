import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/core/utils/text_sanitizer.dart';

void main() {
  test('通常の日本語テキストはそのまま返す', () {
    expect(sanitizeScrapedText('厚生労働省からのお知らせです。'), '厚生労働省からのお知らせです。');
  });

  test('私用領域（アイコンフォント）の文字を取り除く', () {
    final withIcon = '外部リンク記事タイトル';
    expect(sanitizeScrapedText(withIcon), '外部リンク記事タイトル');
  });

  test('ゼロ幅文字・BOM・置換文字を取り除く', () {
    final withZeroWidth = 'あ​い﻿う�え';
    expect(sanitizeScrapedText(withZeroWidth), 'あいうえ');
  });

  test('改行・タブは保持する', () {
    expect(sanitizeScrapedText('1行目\n2行目\tタブ'), '1行目\n2行目\tタブ');
  });

  test('リスト版は各要素に適用する', () {
    expect(
      sanitizeScrapedTextList(['あ', 'い']),
      ['あ', 'い'],
    );
  });
}
