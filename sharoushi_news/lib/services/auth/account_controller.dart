import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../repositories/article_repository.dart';
import 'auth_models.dart';
import 'auth_service.dart';

/// アカウント状態と、おすすめトピック・既読状態の端末間同期をまとめて扱う。
///
/// ログインしていない間は、おすすめトピックの選択状態をこの端末
/// （[SharedPreferences]）にだけ保存する（[ArticleRepository]の既読状態は
/// 元々ローカルDB/インメモリに保存されている）。ログインすると、クラウド
/// （Supabaseの`sharoushi_news_progress`テーブル）上の内容とこの端末の内容を
/// 両方取り入れ（和集合でマージ）、以後の変更はクラウドへも都度反映する。
class AccountController extends ChangeNotifier {
  AccountController({required AuthService authService, required ArticleRepository repository})
    : _auth = authService,
      _repository = repository;

  static const _topicsKey = 'sharoushiNews.selectedTopicIds.v1';

  final AuthService _auth;
  final ArticleRepository _repository;
  SharedPreferences? _prefs;

  Set<String> _selectedTopicIds = {};
  Set<String> _pendingRemoteReadIds = {};
  bool _suppressPush = false;
  AuthRedirectResult? _pendingRedirect;

  AuthService get auth => _auth;
  AuthUser? get user => _auth.user;
  bool get signedIn => _auth.signedIn;
  Set<String> get selectedTopicIds => Set.unmodifiable(_selectedTopicIds);

  /// メール確認・パスワード再設定・メールアドレス変更のリンクから戻って
  /// きた直後の内容（Web版のみ）。呼び出すと一度きりで消費される。
  AuthRedirectResult? takePendingRedirect() {
    final r = _pendingRedirect;
    _pendingRedirect = null;
    return r;
  }

  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _auth.init();
    _selectedTopicIds = (_prefs!.getStringList(_topicsKey) ?? const <String>[]).toSet();

    _auth.addListener(notifyListeners);
    _repository.addListener(_onRepositoryChanged);

    _pendingRedirect = _auth.readAuthRedirect();

    if (_auth.signedIn) {
      await _pullFromCloud();
    }
  }

  @override
  void dispose() {
    _repository.removeListener(_onRepositoryChanged);
    _auth.removeListener(notifyListeners);
    super.dispose();
  }

  Future<void> setSelectedTopicIds(Set<String> ids) async {
    _selectedTopicIds = ids;
    await _persistLocalTopics();
    notifyListeners();
    if (_auth.signedIn) unawaited(_pushToCloud());
  }

  Future<void> signOut() async {
    await _auth.signOut();
    // ローカルの選択・既読状態はこの端末のゲスト用としてそのまま残す。
  }

  /// ログイン・新規登録が成功した直後に呼ぶ。今までこの端末で使っていた
  /// 内容（ゲスト状態）をアカウントへ引き継ぐ。
  Future<void> syncAfterAuthChange() => _pullFromCloud();

  void _onRepositoryChanged() {
    if (_suppressPush) return;
    unawaited(_applyPendingRemoteReadIds());
    if (_auth.signedIn) unawaited(_pushToCloud());
  }

  Set<String> get _localReadIds =>
      _repository.articles.where((a) => a.isRead).map((a) => a.id).toSet();

  Future<void> _persistLocalTopics() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setStringList(_topicsKey, _selectedTopicIds.toList());
  }

  Map<String, dynamic> _buildProgress() => {
    'selectedTopicIds': _selectedTopicIds.toList(),
    'readArticleIds': _localReadIds.toList(),
  };

  Future<void> _pushToCloud() async {
    try {
      await _auth.saveProgress(_buildProgress());
    } catch (_) {
      // オフライン等で失敗しても、次に状態が変わったときに改めて送られる。
    }
  }

  Future<void> _pullFromCloud() async {
    try {
      final remote = await _auth.fetchProgress();
      if (remote == null) {
        // 初めてこのアカウントでログインした場合: 今までこの端末で使って
        // いた内容（ゲスト状態）をそのままアカウントに積む。
        await _pushToCloud();
        return;
      }
      final remoteTopics = ((remote['selectedTopicIds'] as List?) ?? const [])
          .cast<String>()
          .toSet();
      final remoteReadIds = ((remote['readArticleIds'] as List?) ?? const [])
          .cast<String>()
          .toSet();

      _selectedTopicIds = _selectedTopicIds.union(remoteTopics);
      await _persistLocalTopics();

      _pendingRemoteReadIds = remoteReadIds.difference(_localReadIds);
      await _applyPendingRemoteReadIds();

      notifyListeners();
      // マージ結果（この端末にしか無かった分を含む）をクラウドへ書き戻す。
      await _pushToCloud();
    } catch (_) {
      // オフライン等で取得できなくても、ローカルの内容でそのまま使える。
    }
  }

  /// クラウドから受け取った既読記事IDのうち、まだローカルの一覧に無い
  /// （日次フィードの読み込み待ち等の）ものは、一覧に現れた時点で改めて
  /// 既読にする。
  Future<void> _applyPendingRemoteReadIds() async {
    if (_pendingRemoteReadIds.isEmpty) return;
    final existingIds = _repository.articles.map((a) => a.id).toSet();
    final applicable = _pendingRemoteReadIds.intersection(existingIds);
    if (applicable.isEmpty) return;
    _pendingRemoteReadIds = _pendingRemoteReadIds.difference(applicable);
    _suppressPush = true;
    try {
      for (final id in applicable) {
        await _repository.markAsRead(id);
      }
    } finally {
      _suppressPush = false;
    }
  }
}
