/// ログイン中のユーザー情報。
class AuthUser {
  const AuthUser({required this.id, required this.email, required this.username});

  final String id;
  final String email;
  final String username;
}

/// 新規登録の結果。確認メールが必要な設定の場合、登録直後はまだ
/// ログイン状態にならない（[needsConfirm] が true）。
class SignUpResult {
  const SignUpResult({required this.needsConfirm});

  final bool needsConfirm;
}

/// 確認・パスワード再設定・メールアドレス変更のメールのリンクから
/// 戻ってきたときの内容（Web版のみ発生する）。
class AuthRedirectResult {
  const AuthRedirectResult({required this.type, this.error, this.pendingUser});

  /// 'signup' | 'recovery' | 'email_change' | 'error'
  final String type;

  /// リンクが無効・期限切れ等の場合のエラーメッセージ。
  final String? error;

  /// ログイン処理が完了し、ユーザー情報を取得し終えるまで待つFuture。
  /// [error] がある場合はnull。
  final Future<AuthUser?>? pendingUser;
}
