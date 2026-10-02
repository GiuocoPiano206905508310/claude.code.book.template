import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_models.dart';
import 'url_fragment.dart';

/// アカウント・進行状況のクラウド保存（このアプリ専用のSupabaseプロジェクト
/// を使い、raw HTTPでREST APIを直接叩く）。
///
/// supabase-js等の公式SDKは使わない。このアプリで必要なのは「登録・
/// ログイン・トークン更新・1行の読み書き」だけであり、他のサービス
/// （[AiSummaryService]等）と同様にhttpパッケージで直接REST APIを呼ぶ方針に
/// 合わせる。
///
/// 当初はline-puzzle等このリポジトリの他アプリと同じSupabaseプロジェクトを
/// 共有していたが、アカウントがアプリ間で共通になってしまう（同じ
/// メールアドレスで登録済み扱いになる）ことが判明したため、このアプリ専用の
/// プロジェクトに分離した。
class AuthService extends ChangeNotifier {
  AuthService({http.Client? client}) : _client = client ?? http.Client();

  static const _urlBase = 'https://lhmbhdfqpocuuqifyrjs.supabase.co';
  static const _anonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobWJoZGZxcG9jdXVxaWZ5cmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4OTUyNTQsImV4cCI6MjEwNjQ3MTI1NH0.MoupD26_pqVPC-HBSKiLe5Iyyq1lLF9Pq-ZOGnTCvVk';
  static const _table = 'sharoushi_news_progress';
  static const _sessionKey = 'sharoushiNews.session.v1';

  // メール内の確認・パスワード再設定・メールアドレス変更リンクの戻り先。
  // モバイル版はアプリ内にWebページを持たないため、常にGitHub Pages版
  // （Web版）に戻す。
  static const _redirectTo =
      'https://giuocopiano206905508310.github.io/claude.code.book.template/SharoushiNews/';

  final http.Client _client;
  SharedPreferences? _prefs;
  _Session? _session;

  AuthUser? get user => _session?.user;
  bool get signedIn => _session != null;

  /// 起動時に一度呼び出し、前回ログインの続きを復元する。
  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_sessionKey);
    if (raw == null) return;
    try {
      final s = _Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      _session = s;
    } catch (_) {
      await _prefs!.remove(_sessionKey);
    }
  }

  Future<void> _storeSession(_Session? session) async {
    _session = session;
    _prefs ??= await SharedPreferences.getInstance();
    if (session == null) {
      await _prefs!.remove(_sessionKey);
    } else {
      await _prefs!.setString(_sessionKey, jsonEncode(session.toJson()));
    }
    notifyListeners();
  }

  /* ---------- 通信 ---------- */

  Future<dynamic> _request(
    String path, {
    String method = 'GET',
    Map<String, String>? headers,
    Object? body,
    String? token,
  }) async {
    final allHeaders = <String, String>{
      'apikey': _anonKey,
      'Content-Type': 'application/json',
      ...?headers,
    };
    if (token != null) allHeaders['Authorization'] = 'Bearer $token';

    http.Response res;
    try {
      res = await _client
          .send(
            http.Request(method, Uri.parse('$_urlBase$path'))
              ..headers.addAll(allHeaders)
              ..body = body != null ? jsonEncode(body) : '',
          )
          .then(http.Response.fromStream);
    } catch (_) {
      throw Exception('通信に失敗しました。電波の届く場所でもう一度お試しください。');
    }

    dynamic data;
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(res.body);
      } catch (_) {
        data = {'message': res.body};
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw _apiError(res.statusCode, data);
    }
    return data;
  }

  // Supabaseのエラーを日本語の案内に置き換える。
  Exception _apiError(int status, dynamic data) {
    final raw = data is Map
        ? (data['error_description'] ?? data['msg'] ?? data['message'] ?? data['error'] ?? '')
              .toString()
        : '';
    final low = raw.toLowerCase();
    String msg;
    if (low.contains('invalid login credentials')) {
      msg = 'メールアドレスかパスワードが違います。';
    } else if (low.contains('email not confirmed')) {
      msg = 'メールの確認がまだ済んでいません。届いたメールのリンクを開いてください。';
    } else if (low.contains('already registered') ||
        low.contains('already exists') ||
        (status == 422 && low.contains('user') && low.contains('exist'))) {
      msg = 'このメールアドレスはすでに登録されています。';
    } else if (low.contains('should be different')) {
      msg = '新しいパスワードは、今までと違うものにしてください。';
    } else if (low.contains('password should be') ||
        (low.contains('password') && status == 422)) {
      msg = 'パスワードは6文字以上にしてください。';
    } else if (low.contains('invalid email') || low.contains('unable to validate email')) {
      msg = 'メールアドレスの形式が正しくありません。';
    } else if (low.contains('for security purposes') || status == 429) {
      msg = '短い間に何度も試されました。少し待ってからお試しください。';
    } else if (low.contains('delete_my_account')) {
      msg = 'アカウント削除の仕組みがサーバーに設定されていません。管理者に連絡してください。';
    } else if (status == 404 || low.contains('does not exist') || low.contains('schema cache')) {
      msg = '保存用のテーブルが見つかりません。管理者に連絡してください。';
    } else {
      msg = raw.isNotEmpty ? raw : 'エラーが発生しました（$status）';
    }
    return _ApiException(status, msg);
  }

  // 期限が切れていればトークンを更新してから使う。
  Future<String> _withToken() async {
    final session = _session;
    if (session == null) throw Exception('ログインしていません');
    if (DateTime.now().millisecondsSinceEpoch < session.expiresAt) {
      return session.accessToken;
    }
    if (session.refreshToken.isEmpty) {
      await _storeSession(null);
      throw Exception('ログインの有効期限が切れました');
    }
    try {
      final data = await _request(
        '/auth/v1/token?grant_type=refresh_token',
        method: 'POST',
        body: {'refresh_token': session.refreshToken},
      );
      final s = _shapeSession(data as Map<String, dynamic>, fallbackUser: session.user);
      if (s == null) throw Exception('ログインの有効期限が切れました');
      await _storeSession(s);
      return s.accessToken;
    } catch (e) {
      await _storeSession(null);
      rethrow;
    }
  }

  _Session? _shapeSession(Map<String, dynamic> data, {AuthUser? fallbackUser}) {
    final accessToken = data['access_token'] as String?;
    if (accessToken == null) return null;
    final rawUser = data['user'] as Map<String, dynamic>?;
    final expiresIn = (data['expires_in'] as num?)?.toInt() ?? 3600;
    final user = rawUser != null
        ? AuthUser(
            id: rawUser['id'] as String? ?? '',
            email: rawUser['email'] as String? ?? '',
            username: _userName(rawUser),
          )
        : (fallbackUser ?? const AuthUser(id: '', email: '', username: ''));
    return _Session(
      accessToken: accessToken,
      refreshToken: data['refresh_token'] as String? ?? '',
      // 期限の30秒手前で切れた扱いにして、ぎりぎりの失敗を避ける。
      expiresAt:
          DateTime.now().millisecondsSinceEpoch + (expiresIn - 30).clamp(0, expiresIn) * 1000,
      user: user,
    );
  }

  String _userName(Map<String, dynamic> user) {
    final meta = user['user_metadata'] as Map<String, dynamic>?;
    final username = meta?['username'] as String?;
    if (username != null && username.isNotEmpty) return username;
    final email = user['email'] as String? ?? '';
    return email.split('@').first;
  }

  /* ---------- 公開する操作 ---------- */

  String _checkName(String name) {
    final trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      throw Exception('ユーザー名は2〜20文字にしてください。');
    }
    return trimmed;
  }

  /// [metadata]はユーザー名とあわせてuser_metadataに保存される
  /// （利用規約への同意記録等）。
  Future<SignUpResult> signUp(
    String username,
    String email,
    String password, {
    Map<String, Object?> metadata = const {},
  }) async {
    final name = _checkName(username);
    final data =
        await _request(
              '/auth/v1/signup?redirect_to=${Uri.encodeComponent(_redirectTo)}',
              method: 'POST',
              body: {
                'email': email.trim(),
                'password': password,
                'data': {...metadata, 'username': name},
              },
            )
            as Map<String, dynamic>;

    // 確認メールを送る設定のとき、すでに登録済みのメールでも Supabase は
    // 成功のような形で返す（他人のメールが登録済みかを外から調べられない
    // ため）。その場合は identities が空で返るので、それで見分ける。
    final identities = data['identities'] as List?;
    if (identities != null && identities.isEmpty) {
      throw Exception('このメールアドレスはすでに登録されています。ログインしてください。');
    }
    final s = _shapeSession(data);
    if (s != null) {
      await _storeSession(s);
      return const SignUpResult(needsConfirm: false);
    }
    // 確認メールが必要な設定のときは、ここではまだログインできない。
    return const SignUpResult(needsConfirm: true);
  }

  Future<AuthUser> signIn(String email, String password) async {
    final data =
        await _request(
              '/auth/v1/token?grant_type=password',
              method: 'POST',
              body: {'email': email.trim(), 'password': password},
            )
            as Map<String, dynamic>;
    final s = _shapeSession(data);
    if (s == null) throw Exception('ログインできませんでした。');
    await _storeSession(s);
    return s.user;
  }

  Future<void> signOut() async {
    final token = _session?.accessToken;
    await _storeSession(null);
    if (token == null) return;
    // 手元のログイン状態はすでに消してあるので、失敗しても支障はない。
    try {
      await _request('/auth/v1/logout', method: 'POST', token: token, body: const {});
    } catch (_) {
      // 無視する。
    }
  }

  Future<void> sendReset(String email) async {
    await _request(
      '/auth/v1/recover?redirect_to=${Uri.encodeComponent(_redirectTo)}',
      method: 'POST',
      body: {'email': email.trim()},
    );
  }

  Future<dynamic> _updateUser(Map<String, dynamic> body, {bool needsRedirect = false}) async {
    final token = await _withToken();
    final path = needsRedirect
        ? '/auth/v1/user?redirect_to=${Uri.encodeComponent(_redirectTo)}'
        : '/auth/v1/user';
    final data = await _request(path, method: 'PUT', token: token, body: body);
    // 変更が即時に効くもの（ユーザー名・パスワード）は手元の情報も更新する。
    final session = _session;
    if (session != null && data is Map<String, dynamic> && data['id'] != null) {
      final updated = _Session(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        user: AuthUser(
          id: session.user.id,
          email: data['email'] as String? ?? session.user.email,
          username: _userName(data).isNotEmpty ? _userName(data) : session.user.username,
        ),
      );
      await _storeSession(updated);
    }
    return data;
  }

  Future<String> changeName(String username) async {
    final name = _checkName(username);
    await _updateUser({
      'data': {'username': name},
    });
    return name;
  }

  /// メールアドレスの変更は、新しいアドレス宛の確認メールが済むまで反映されない。
  Future<void> changeEmail(String email) async {
    await _updateUser({'email': email.trim()}, needsRedirect: true);
  }

  /// パスワードだけを差し替える。メールの再設定リンクから来たときに使う
  /// （その場合は今のパスワードを知らないので確かめようがない）。
  Future<void> setPassword(String password) async {
    if (password.length < 6) {
      throw Exception('パスワードは6文字以上にしてください。');
    }
    await _updateUser({'password': password});
  }

  /// ログイン中に自分で変える。今のパスワードを知っている人だけが変えられる
  /// よう、先に今のパスワードで入り直して確かめる（端末を横取りされても
  /// 変えられない）。
  Future<void> changePassword(String current, String next) async {
    if (next.length < 6) {
      throw Exception('新しいパスワードは6文字以上にしてください。');
    }
    await _reauthenticate(current);
    await setPassword(next);
  }

  /// アカウントと、それに紐づくクラウド上の同期データを削除する。
  /// 端末を横取りされても消されないよう、今のパスワードで入り直して確かめる。
  /// 削除はSupabase側の`delete_my_account`関数（ログイン中の本人の行だけを
  /// 消す）で行う。service_roleキーをアプリに置かずに済ませるため。
  Future<void> deleteAccount(String currentPassword) async {
    await _reauthenticate(currentPassword);
    final token = await _withToken();
    await _request('/rest/v1/rpc/delete_my_account', method: 'POST', token: token, body: const {});
    // ユーザー自体が消えたので、サーバー側のログアウトは不要。
    await _storeSession(null);
  }

  Future<void> _reauthenticate(String password) async {
    final u = _session?.user;
    if (u == null) throw Exception('ログインしていません');
    if (password.isEmpty) throw Exception('現在のパスワードを入れてください。');
    try {
      final data =
          await _request(
                '/auth/v1/token?grant_type=password',
                method: 'POST',
                body: {'email': u.email, 'password': password},
              )
              as Map<String, dynamic>;
      final s = _shapeSession(data, fallbackUser: u);
      if (s != null) await _storeSession(s);
    } on _ApiException catch (e) {
      // 合っているかどうかの話なのか、通信の失敗なのかを混ぜない。
      if (e.status == 400) throw Exception('現在のパスワードが違います。');
      rethrow;
    }
  }

  /* ---------- メールのリンクから戻ってきたとき ----------
     Supabaseは確認できたら
       …/SharoushiNews/#access_token=…&refresh_token=…&type=signup
     の形で戻してくる（失敗時は #error_description=… ）。ここでその#を
     読み取ってログイン状態にし、URLからは消す。typeはsignup（新規登録の
     確認）/recovery（パスワード再設定）/email_change（メールアドレス変更の
     確認）。Web版でのみ意味を持つ（モバイル版では常にnull）。 */
  AuthRedirectResult? readAuthRedirect() {
    final hash = readUrlFragment() ?? '';
    if (hash.length < 2 || !hash.contains('=')) return null;
    final q = <String, String>{};
    for (final pair in hash.substring(1).split('&')) {
      final i = pair.indexOf('=');
      if (i > 0) {
        q[Uri.decodeComponent(pair.substring(0, i))] = Uri.decodeComponent(
          pair.substring(i + 1).replaceAll('+', ' '),
        );
      }
    }
    if (!q.containsKey('access_token') &&
        !q.containsKey('error_description') &&
        !q.containsKey('error')) {
      return null;
    }

    // 同じリンクを二度処理しないよう、URLから#を落とす。
    clearUrlFragment();

    final accessToken = q['access_token'];
    if (accessToken == null) {
      var msg = q['error_description'] ?? q['error'] ?? '';
      if (RegExp('expired', caseSensitive: false).hasMatch(msg)) {
        msg = 'このリンクは期限切れです。もう一度お試しください。';
      } else if (RegExp('invalid', caseSensitive: false).hasMatch(msg)) {
        msg = 'このリンクは使えません。もう一度お試しください。';
      }
      return AuthRedirectResult(
        type: q['type'] ?? 'error',
        error: msg.isNotEmpty ? msg : 'リンクを確認できませんでした。',
      );
    }

    final s = _shapeSession({
      'access_token': accessToken,
      'refresh_token': q['refresh_token'],
      'expires_in': int.tryParse(q['expires_in'] ?? '') ?? 3600,
    });
    if (s == null) {
      return const AuthRedirectResult(type: 'error', error: 'リンクを確認できませんでした。');
    }
    // リンクの#にはユーザー情報が入っていないので、改めて取りに行く。
    final pending = _storeSession(s).then((_) => _fetchUser());
    return AuthRedirectResult(type: q['type'] ?? 'signup', pendingUser: pending);
  }

  Future<AuthUser?> _fetchUser() async {
    final token = await _withToken();
    final data = await _request('/auth/v1/user', token: token) as Map<String, dynamic>?;
    final session = _session;
    if (session != null && data != null && data['id'] != null) {
      final user = AuthUser(
        id: data['id'] as String,
        email: data['email'] as String? ?? '',
        username: _userName(data),
      );
      await _storeSession(
        _Session(
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          user: user,
        ),
      );
      return user;
    }
    return _session?.user;
  }

  /* ---------- 進行状況（おすすめトピック・既読状態）の保存 ---------- */

  /// クラウドに保存されている進行状況。まだ無ければnull。
  Future<Map<String, dynamic>?> fetchProgress() async {
    final token = await _withToken();
    final userId = _session!.user.id;
    final data =
        await _request(
              '/rest/v1/$_table?select=progress&user_id=eq.${Uri.encodeComponent(userId)}',
              token: token,
            )
            as List?;
    if (data == null || data.isEmpty) return null;
    final progress = data.first['progress'];
    return progress is Map<String, dynamic> ? progress : null;
  }

  Future<void> saveProgress(Map<String, dynamic> progress) async {
    final token = await _withToken();
    final userId = _session!.user.id;
    await _request(
      '/rest/v1/$_table?on_conflict=user_id',
      method: 'POST',
      token: token,
      headers: const {'Prefer': 'resolution=merge-duplicates,return=minimal'},
      body: [
        {'user_id': userId, 'progress': progress, 'updated_at': DateTime.now().toIso8601String()},
      ],
    );
  }
}

/// HTTPステータスを保持するAPIエラー。toString()は通常のExceptionと同じ
/// 「Exception: メッセージ」形式にして、画面側の表示処理を共通にする。
class _ApiException implements Exception {
  _ApiException(this.status, this.message);

  final int status;
  final String message;

  @override
  String toString() => 'Exception: $message';
}

class _Session {
  const _Session({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresAt;
  final AuthUser user;

  Map<String, dynamic> toJson() => {
    'access_token': accessToken,
    'refresh_token': refreshToken,
    'expires_at': expiresAt,
    'user': {'id': user.id, 'email': user.email, 'username': user.username},
  };

  factory _Session.fromJson(Map<String, dynamic> json) {
    final u = json['user'] as Map<String, dynamic>;
    return _Session(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String? ?? '',
      expiresAt: json['expires_at'] as int,
      user: AuthUser(
        id: u['id'] as String,
        email: u['email'] as String,
        username: u['username'] as String,
      ),
    );
  }
}
