import 'package:flutter/foundation.dart';

import '../models/article.dart';
import '../services/feed/daily_feed_service.dart';
import 'dummy_seed_data.dart';

/// 記事データへのアクセスを抽象化するリポジトリ（仕様セクション19）。
/// Web実行時のフォールバックとして [DummyArticleRepository]（インメモリ）、
/// それ以外のプラットフォームでは [LocalArticleRepository]（ローカルDB、
/// Phase 3〜）を使う。将来的にはクラウドDB版に差し替えられるよう、UI 側は
/// このインターフェースだけに依存させる。
abstract class ArticleRepository extends ChangeNotifier {
  List<Article> get articles;

  Future<void> toggleFavorite(String id);
  Future<void> markAsRead(String id);

  /// GitHub Actions上で1日1回更新される記事一覧（[DailyFeedService]）を
  /// 取得し、表示中の一覧をその内容に合わせる（新規記事の追加・更新に加え、
  /// フィードから外れた記事は削除する）。オフライン等で取得に失敗した場合は
  /// 何もせず、既存の表示をそのまま維持する。
  Future<void> refreshFromDailyFeed();
}

/// Web向けのインメモリ実装。起動直後はダミーデータ15件を保持し、
/// [refreshFromDailyFeed] で日次フィードの内容に置き換わる。
/// お気に入り・既読状態は永続化されない。
class DummyArticleRepository extends ArticleRepository {
  DummyArticleRepository({DailyFeedService? feedService})
    : _articles = buildSeedArticles(),
      _feedService = feedService ?? DailyFeedService();

  List<Article> _articles;
  final DailyFeedService _feedService;

  @override
  List<Article> get articles => List.unmodifiable(_articles);

  @override
  Future<void> toggleFavorite(String id) async {
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isFavorite: !a.isFavorite) else a,
    ];
    notifyListeners();
  }

  @override
  Future<void> markAsRead(String id) async {
    final target = _articles.firstWhere((a) => a.id == id);
    if (target.isRead) return;
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isRead: true) else a,
    ];
    notifyListeners();
  }

  /// 日次フィードの内容で表示中の一覧を完全に置き換える（お気に入り・
  /// 既読状態は同一idの記事があれば引き継ぐ）。これにより、初期シード
  /// データやフィードから外れた記事（社労士実務と無関係と判定され
  /// 除外された記事等）は自動的に表示されなくなる。
  @override
  Future<void> refreshFromDailyFeed() async {
    try {
      final fetched = await _feedService.fetchDailyFeed();
      final existingById = {for (final a in _articles) a.id: a};
      _articles = [
        for (final a in fetched)
          if (existingById[a.id] case final existing?)
            a.copyWith(isFavorite: existing.isFavorite, isRead: existing.isRead)
          else
            a,
      ];
      notifyListeners();
    } catch (_) {
      // オフライン等で取得できない場合は既存の表示をそのまま維持する。
    }
  }
}
