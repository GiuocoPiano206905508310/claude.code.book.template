import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../repositories/article_repository.dart';
import 'auth_models.dart';
import 'auth_service.dart';

/// アカウント状態と、おすすめトピック・既読状態・お気に入り状態の端末間
/// 同期をまとめて扱う。
///
/// ログインしていない間は、おすすめトピックの選択状態をこの端末
/// （[SharedPreferences]）にだけ保存する（[ArticleRepository]の既読・
/// お気に入り状態は元々ローカルDB/インメモリに保存されている）。ログイン
/// すると、クラウド（Supabaseの`sharoushi_news_progress`テーブル）上の内容と
/// この端末の内容を両方取り入れ（和集合でマージ）、以後の変更はクラウドへも
/// 都度反映する。
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
  Set<String> _pendingRemoteFavoriteIds = {};
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
    unawaited(_applyPendingRemoteIds());
    if (_auth.signedIn) unawaited(_pushToCloud());
  }

  Set<String> get _localReadIds =>
      _repository.articles.where((a) => a.isRead).map((a) => a.id).toSet();

  Set<String> get _localFavoriteIds =>
      _repository.articles.where((a) => a.isFavorite).map((a) => a.id).toSet();

  Future<void> _persistLocalTopics() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setStringList(_topicsKey, _selectedTopicIds.toList());
  }

  Map<String, dynamic> _buildProgress() => {
    'selectedTopicIds': _selectedTopicIds.toList(),
    'readArticleIds': _localReadIds.toList(),
    'favoriteArticleIds': _localFavoriteIds.toList(),
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
      final remoteFavoriteIds = ((remote['favoriteArticleIds'] as List?) ?? const [])
          .cast<String>()
          .toSet();

      _selectedTopicIds = _selectedTopicIds.union(remoteTopics);
      await _persistLocalTopics();

      _pendingRemoteReadIds = remoteReadIds.difference(_localReadIds);
      _pendingRemoteFavoriteIds = remoteFavoriteIds.difference(_localFavoriteIds);
      await _applyPendingRemoteIds();

      notifyListeners();
      // マージ結果（この端末にしか無かった分を含む）をクラウドへ書き戻す。
      await _pushToCloud();
    } catch (_) {
      // オフライン等で取得できなくても、ローカルの内容でそのまま使える。
    }
  }

  /// クラウドから受け取った既読・お気に入り記事IDのうち、まだローカルの
  /// 一覧に無い（日次フィードの読み込み待ち等の）ものは、一覧に現れた時点で
  /// 改めて反映する。
  Future<void> _applyPendingRemoteIds() async {
    if (_pendingRemoteReadIds.isEmpty && _pendingRemoteFavoriteIds.isEmpty) return;
    final byId = {for (final a in _repository.articles) a.id: a};

    final readApplicable = _pendingRemoteReadIds.where(byId.containsKey).toSet();
    final favoriteApplicable = _pendingRemoteFavoriteIds.where(byId.containsKey).toSet();
    if (readApplicable.isEmpty && favoriteApplicable.isEmpty) return;

    _pendingRemoteReadIds = _pendingRemoteReadIds.difference(readApplicable);
    _pendingRemoteFavoriteIds = _pendingRemoteFavoriteIds.difference(favoriteApplicable);

    _suppressPush = true;
    try {
      for (final id in readApplicable) {
        await _repository.markAsRead(id);
      }
      for (final id in favoriteApplicable) {
        if (!byId[id]!.isFavorite) {
          await _repository.toggleFavorite(id);
        }
      }
    } finally {
      _suppressPush = false;
    }
  }
}
