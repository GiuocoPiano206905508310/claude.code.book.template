/// スクレイピング元のHTMLに、アイコンフォント等が使うUnicode私用領域（PUA）の
/// 文字や制御文字がテキストとして紛れ込んでいることがある。対応する字形を
/// 持たない環境では「豆腐（□に×）」のような文字化けとして表示され、選択して
/// コピーした際にもその文字が残ってしまうため、表示前に必ず取り除く。
String sanitizeScrapedText(String text) {
  final buffer = StringBuffer();
  for (final rune in text.runes) {
    if (_isStrippedRune(rune)) continue;
    buffer.writeCharCode(rune);
  }
  return buffer.toString();
}

List<String> sanitizeScrapedTextList(List<String> texts) =>
    texts.map(sanitizeScrapedText).toList();

bool _isStrippedRune(int rune) {
  // 改行・タブ以外のC0/C1制御文字。
  if (rune == 0x09 || rune == 0x0A || rune == 0x0D) return false;
  if (rune < 0x20 || (rune >= 0x7F && rune <= 0x9F)) return true;
  // ゼロ幅文字・BOM。
  if (rune == 0x200B || rune == 0x200C || rune == 0x200D || rune == 0xFEFF) {
    return true;
  }
  // Unicode置換文字。
  if (rune == 0xFFFD) return true;
  // 私用領域（アイコンフォントの字形が埋め込まれていることが多い）。
  if (rune >= 0xE000 && rune <= 0xF8FF) return true;
  if (rune >= 0xF0000 && rune <= 0xFFFFD) return true;
  if (rune >= 0x100000 && rune <= 0x10FFFD) return true;
  return false;
}
