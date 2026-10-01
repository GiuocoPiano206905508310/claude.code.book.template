import 'package:flutter/material.dart';

import '../../services/auth/account_controller.dart';

/// ログイン・新規登録画面。
class AccountAuthScreen extends StatefulWidget {
  const AccountAuthScreen({super.key, required this.controller});

  final AccountController controller;

  @override
  State<AccountAuthScreen> createState() => _AccountAuthScreenState();
}

class _AccountAuthScreenState extends State<AccountAuthScreen> {
  bool _isSignUp = false;
  bool _busy = false;
  String? _errorMessage;

  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();
  final _signUpUsernameController = TextEditingController();
  final _signUpEmailController = TextEditingController();
  final _signUpPasswordController = TextEditingController();

  @override
  void dispose() {
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _signUpUsernameController.dispose();
    _signUpEmailController.dispose();
    _signUpPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ログイン / 新規登録')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'アカウントを作ると、おすすめトピックの設定・既読状態・お気に入りが、どの端末からでも続けられます。',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.6,
                ),
              ),
              const SizedBox(height: 20),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: false, label: Text('ログイン')),
                  ButtonSegment(value: true, label: Text('新規登録')),
                ],
                selected: {_isSignUp},
                onSelectionChanged: _busy
                    ? null
                    : (selection) => setState(() {
                        _isSignUp = selection.first;
                        _errorMessage = null;
                      }),
              ),
              const SizedBox(height: 20),
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
              if (_isSignUp) _buildSignUpForm() else _buildLoginForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _loginEmailController,
          enabled: !_busy,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(
            labelText: 'メールアドレス',
            hintText: 'you@example.com',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _loginPasswordController,
          enabled: !_busy,
          obscureText: true,
          autofillHints: const [AutofillHints.password],
          decoration: const InputDecoration(labelText: 'パスワード', hintText: '6文字以上'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _submitLogin,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('ログイン'),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: _busy ? null : _showForgotPasswordDialog, child: const Text('パスワードを忘れた方')),
      ],
    );
  }

  Widget _buildSignUpForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _signUpUsernameController,
          enabled: !_busy,
          autofillHints: const [AutofillHints.nickname],
          maxLength: 20,
          decoration: const InputDecoration(labelText: 'ユーザー名', hintText: '2〜20文字'),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _signUpEmailController,
          enabled: !_busy,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(
            labelText: 'メールアドレス',
            hintText: 'you@example.com',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _signUpPasswordController,
          enabled: !_busy,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          decoration: const InputDecoration(labelText: 'パスワード', hintText: '6文字以上'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _submitSignUp,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('登録して始める'),
        ),
      ],
    );
  }

  Future<void> _submitLogin() async {
    final email = _loginEmailController.text.trim();
    final password = _loginPasswordController.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'メールアドレスとパスワードを入れてください。');
      return;
    }
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    try {
      await widget.controller.auth.signIn(email, password);
      await widget.controller.syncAfterAuthChange();
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageOf(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitSignUp() async {
    final username = _signUpUsernameController.text.trim();
    final email = _signUpEmailController.text.trim();
    final password = _signUpPasswordController.text;
    if (username.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'すべての欄を入れてください。');
      return;
    }
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    try {
      final result = await widget.controller.auth.signUp(username, email, password);
      if (result.needsConfirm) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _errorMessage = null;
        });
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('確認メールを送りました'),
            content: const Text('メールのリンクを開いてから、ログインしてください。'),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
            ],
          ),
        );
        if (!mounted) return;
        setState(() => _isSignUp = false);
        return;
      }
      await widget.controller.syncAfterAuthChange();
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = _messageOf(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showForgotPasswordDialog() async {
    final controller = TextEditingController(text: _loginEmailController.text.trim());
    final email = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('パスワード再設定'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(
            labelText: 'メールアドレス',
            hintText: 'you@example.com',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('キャンセル')),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('送信'),
          ),
        ],
      ),
    );
    if (email == null || email.isEmpty || !mounted) return;
    try {
      await widget.controller.auth.sendReset(email);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('パスワード再設定のメールを送りました。')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_messageOf(e))));
    }
  }

  String _messageOf(Object e) => e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e';
}
