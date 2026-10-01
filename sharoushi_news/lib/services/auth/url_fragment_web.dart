// ignore_for_file: deprecated_member_use
import 'dart:html' as html;

/// Supabaseの確認・パスワード再設定メールのリンクから戻ってきたときの
/// `#access_token=...` 部分を読む（Web版のみ）。
String? readUrlFragment() {
  final hash = html.window.location.hash;
  return hash.isEmpty ? null : hash;
}

/// 同じリンクを再読み込みで二重処理しないよう、URLから#部分を消す。
void clearUrlFragment() {
  final path = html.window.location.pathname ?? '/';
  final search = html.window.location.search ?? '';
  html.window.history.replaceState(null, '', path + search);
}
