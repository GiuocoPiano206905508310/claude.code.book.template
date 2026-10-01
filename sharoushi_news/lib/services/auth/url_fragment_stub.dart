/// Web以外のプラットフォーム向けのスタブ。
/// メール確認・パスワード再設定のリンクはWeb版（GitHub Pages）にしか
/// 戻ってこないため、モバイル版ではURLの#部分を読む必要がない。
String? readUrlFragment() => null;

void clearUrlFragment() {}
