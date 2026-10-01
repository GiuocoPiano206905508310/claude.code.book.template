import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sharoushi_news/repositories/article_repository.dart';
import 'package:sharoushi_news/services/auth/account_controller.dart';
import 'package:sharoushi_news/services/auth/auth_service.dart';

void main() {
  const userId = 'user-1';

  http.Response jsonResponse(Object body, {int status = 200}) =>
      http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});

  MockClient buildClient({
    required Map<String, dynamic> progress,
    required List<Map<String, Object?>> savedRows,
  }) {
    return MockClient((request) async {
      final path = request.url.path;
      if (path == '/auth/v1/token') {
        return jsonResponse({
          'access_token': 'token-abc',
          'refresh_token': 'refresh-abc',
          'expires_in': 3600,
          'user': {
            'id': userId,
            'email': 'tester@example.com',
            'user_metadata': {'username': 'テスター'},
          },
        });
      }
      if (path == '/rest/v1/sharoushi_news_progress' && request.method == 'GET') {
        return jsonResponse([
          {'progress': progress},
        ]);
      }
      if (path == '/rest/v1/sharoushi_news_progress' && request.method == 'POST') {
        final rows = jsonDecode(request.body) as List;
        savedRows.add(rows.first as Map<String, Object?>);
        return http.Response('', 201);
      }
      return http.Response('not found', 404);
    });
  }

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('ログイン時、クラウドのおすすめトピック・既読・お気に入りをこの端末に取り込む', () async {
    final savedRows = <Map<String, Object?>>[];
    final client = buildClient(
      progress: {
        'selectedTopicIds': ['social_insurance'],
        'readArticleIds': ['a1'],
        'favoriteArticleIds': ['a2'],
      },
      savedRows: savedRows,
    );
    final repository = DummyArticleRepository();
    final controller = AccountController(
      authService: AuthService(client: client),
      repository: repository,
    );
    await controller.init();
    expect(controller.signedIn, isFalse);

    await controller.auth.signIn('tester@example.com', 'password1');
    await controller.syncAfterAuthChange();

    expect(controller.signedIn, isTrue);
    expect(controller.selectedTopicIds, contains('social_insurance'));
    expect(repository.articles.firstWhere((a) => a.id == 'a1').isRead, isTrue);
    expect(repository.articles.firstWhere((a) => a.id == 'a2').isFavorite, isTrue);

    // マージ結果がクラウドへ書き戻されている。
    expect(savedRows, isNotEmpty);
    final lastSaved = savedRows.last;
    expect(lastSaved['user_id'], userId);
    final savedProgress = lastSaved['progress'] as Map;
    expect(savedProgress['favoriteArticleIds'], contains('a2'));
  });

  test('ログインしていない間は、おすすめトピックの選択をこの端末にだけ保存する', () async {
    final repository = DummyArticleRepository();
    final controller = AccountController(
      authService: AuthService(client: MockClient((_) async => http.Response('', 404))),
      repository: repository,
    );
    await controller.init();

    await controller.setSelectedTopicIds({'harassment'});

    expect(controller.selectedTopicIds, {'harassment'});
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList('sharoushiNews.selectedTopicIds.v1'), ['harassment']);
  });
}
