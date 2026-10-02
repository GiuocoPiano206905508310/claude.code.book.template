import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sharoushi_news/services/auth/auth_service.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  http.Response tokenResponse() => http.Response(
    jsonEncode({
      'access_token': 'token-abc',
      'refresh_token': 'refresh-abc',
      'expires_in': 3600,
      'user': {'id': 'user-1', 'email': 'tester@example.com'},
    }),
    200,
  );

  /// 1回目のトークン発行（ログイン）は成功させ、2回目以降（パスワード
  /// 再確認）の応答は[reauth]で差し替える。
  MockClient client({
    required Future<http.Response> Function() reauth,
    required List<String> calls,
  }) {
    var tokenCalls = 0;
    return MockClient((request) async {
      calls.add('${request.method} ${request.url.path}');
      if (request.url.path == '/auth/v1/token') {
        tokenCalls++;
        return tokenCalls == 1 ? tokenResponse() : reauth();
      }
      if (request.url.path == '/rest/v1/rpc/delete_my_account') {
        return http.Response('', 204);
      }
      return http.Response('not found', 404);
    });
  }

  test('パスワードを確認したうえでアカウントを削除し、ログアウト状態になる', () async {
    final calls = <String>[];
    final auth = AuthService(
      client: client(reauth: () async => tokenResponse(), calls: calls),
    );
    await auth.init();
    await auth.signIn('tester@example.com', 'password1');

    await auth.deleteAccount('password1');

    expect(auth.signedIn, isFalse);
    expect(calls, contains('POST /rest/v1/rpc/delete_my_account'));
  });

  test('パスワードが違う場合は削除せず、ログイン状態を保つ', () async {
    final calls = <String>[];
    final auth = AuthService(
      client: client(
        reauth: () async => http.Response(
          jsonEncode({'error_description': 'Invalid login credentials'}),
          400,
        ),
        calls: calls,
      ),
    );
    await auth.init();
    await auth.signIn('tester@example.com', 'password1');

    await expectLater(
      auth.deleteAccount('wrong'),
      throwsA(predicate((e) => e.toString().contains('現在のパスワードが違います'))),
    );
    expect(auth.signedIn, isTrue);
    expect(calls, isNot(contains('POST /rest/v1/rpc/delete_my_account')));
  });

  test('通信エラーを「パスワードが違う」と誤って表示しない', () async {
    final auth = AuthService(
      client: client(reauth: () async => throw Exception('offline'), calls: []),
    );
    await auth.init();
    await auth.signIn('tester@example.com', 'password1');

    await expectLater(
      auth.deleteAccount('password1'),
      throwsA(predicate((e) => e.toString().contains('通信に失敗しました'))),
    );
    expect(auth.signedIn, isTrue);
  });
}
