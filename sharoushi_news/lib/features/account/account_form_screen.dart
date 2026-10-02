import 'package:flutter/material.dart';

import '../../services/auth/account_controller.dart';

/// 登録内容の変更画面。
/// ユーザー名はその場で変わる。メールアドレスとパスワードは、本人のメールに
/// 届くリンクを開いて初めて変わる（[AccountFormMode.password]は例外で、
/// ログイン中に今のパスワードを確認した上でその場で変える）。
enum AccountFormMode { name, email, password, newPassword, delete }

/// 「パスワードを忘れた」のメールのリンクから開いた場合に表示する画面。
/// 今のパスワードは聞けないので、新しいパスワードだけを決めてもらう。
class AccountFormScreen extends StatefulWidget {
  const AccountFormScreen({super.key, required this.controller, required this.mode});

  final AccountController controller;
  final AccountFormMode mode;

  @override
  State<AccountFormScreen> createState() => _AccountFormScreenState();
}

class _AccountFormScreenState extends State<AccountFormScreen> {
  bool _busy = false;
  String? _errorMessage;

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _newPasswordConfirmController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _nameController.text = widget.controller.user?.username ?? '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _newPasswordConfirmController.dispose();
    super.dispose();
  }

  String get _title => switch (widget.mode) {
    AccountFormMode.name => 'ユーザー名を変更',
    AccountFormMode.email => 'メールアドレスを変更',
    AccountFormMode.password => 'パスワードを変更',
    AccountFormMode.newPassword => '新しいパスワード',
    AccountFormMode.delete => 'アカウントを削除',
  };

  String? get _lede => switch (widget.mode) {
    AccountFormMode.name => '画面に出る名前です。すぐに変わります。',
    AccountFormMode.email => '新しいアドレスに確認のリンクをお送りします。そのリンクを開くまで、ログインは今のアドレスのままです。',
    AccountFormMode.password => null,
    AccountFormMode.newPassword => 'メールのリンクから開きました。新しいパスワードを決めてください。',
    AccountFormMode.delete =>
      'アカウントと、クラウドに保存されているおすすめトピック・既読・お気に入りの記録が削除されます。'
          '削除すると元に戻せません。\n\nこの端末に保存されている設定はそのまま残ります。',
  };

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: widget.mode != AccountFormMode.newPassword,
      child: Scaffold(
        appBar: AppBar(title: Text(_title)),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_lede != null) ...[
                  Text(
                    _lede!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                ..._buildFields(),
                const SizedBox(height: 16),
                FilledButton(
                  style: widget.mode == AccountFormMode.delete
                      ? FilledButton.styleFrom(
                          backgroundColor: Theme.of(context).colorScheme.error,
                          foregroundColor: Theme.of(context).colorScheme.onError,
                        )
                      : null,
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_saveLabel),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String get _saveLabel => switch (widget.mode) {
    AccountFormMode.name => '保存',
    AccountFormMode.email => '確認メールを送る',
    AccountFormMode.password => 'パスワードを変更する',
    AccountFormMode.newPassword => 'このパスワードにする',
    AccountFormMode.delete => 'アカウントを削除する',
  };

  List<Widget> _buildFields() {
    switch (widget.mode) {
      case AccountFormMode.name:
        return [
          TextField(
            controller: _nameController,
            enabled: !_busy,
            maxLength: 20,
            decoration: const InputDecoration(labelText: '新しいユーザー名'),
          ),
        ];
      case AccountFormMode.email:
        return [
          TextField(
            controller: _emailController,
            enabled: !_busy,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(
              labelText: '新しいメールアドレス',
              hintText: 'you@example.com',
            ),
          ),
        ];
      case AccountFormMode.password:
        return [
          TextField(
            controller: _currentPasswordController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: '現在のパスワード'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _newPasswordController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: '新しいパスワード', hintText: '6文字以上'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _newPasswordConfirmController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: '新しいパスワード（確認）'),
          ),
        ];
      case AccountFormMode.newPassword:
        return [
          TextField(
            controller: _newPasswordController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: '新しいパスワード', hintText: '6文字以上'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _newPasswordConfirmController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: '新しいパスワード（確認）'),
          ),
        ];
      case AccountFormMode.delete:
        return [
          TextField(
            controller: _currentPasswordController,
            enabled: !_busy,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: '現在のパスワード'),
          ),
        ];
    }
  }

  Future<void> _submit() async {
    setState(() => _errorMessage = null);
    switch (widget.mode) {
      case AccountFormMode.name:
        await _run(() async {
          final name = await widget.controller.auth.changeName(_nameController.text);
          return 'ユーザー名を $name に変えました';
        });
      case AccountFormMode.email:
        await _run(() async {
          await widget.controller.auth.changeEmail(_emailController.text);
          return '確認メールを送りました。メールのリンクを開くと、新しいアドレスに変わります。';
        }, keepOpen: true);
      case AccountFormMode.password:
        final current = _currentPasswordController.text;
        final next = _newPasswordController.text;
        final confirm = _newPasswordConfirmController.text;
        if (current.isEmpty) {
          setState(() => _errorMessage = '現在のパスワードを入れてください。');
          return;
        }
        if (next != confirm) {
          setState(() => _errorMessage = '新しいパスワードが一致しません。');
          return;
        }
        await _run(() async {
          await widget.controller.auth.changePassword(current, next);
          return 'パスワードを変更しました';
        });
      case AccountFormMode.newPassword:
        final next = _newPasswordController.text;
        final confirm = _newPasswordConfirmController.text;
        if (next != confirm) {
          setState(() => _errorMessage = '新しいパスワードが一致しません。');
          return;
        }
        await _run(() async {
          await widget.controller.auth.setPassword(next);
          return 'パスワードを変更しました';
        });
      case AccountFormMode.delete:
        final current = _currentPasswordController.text;
        if (current.isEmpty) {
          setState(() => _errorMessage = '現在のパスワードを入れてください。');
          return;
        }
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('本当に削除しますか？'),
            content: const Text('アカウントとクラウド上の記録は元に戻せません。'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('キャンセル'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
                child: const Text('削除する'),
              ),
            ],
          ),
        );
        if (confirmed != true || !mounted) return;
        await _run(() async {
          await widget.controller.auth.deleteAccount(current);
          return 'アカウントを削除しました';
        });
    }
  }

  /// [keepOpen]がtrueの場合、完了してもこの画面を閉じずメッセージだけ出す
  /// （メールアドレス変更は、確認メールを開くまでまだ何も変わっていないため）。
  Future<void> _run(Future<String> Function() action, {bool keepOpen = false}) async {
    setState(() => _busy = true);
    try {
      final message = await action();
      if (!mounted) return;
      if (keepOpen) {
        setState(() {
          _busy = false;
          _errorMessage = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      } else {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _errorMessage = _messageOf(e);
      });
    }
  }

  String _messageOf(Object e) => e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e';
}
