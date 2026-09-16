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
  /// 取得し、まだ保持していない記事があれば追加する。オフライン等で取得に
  /// 失敗した場合は何もせず、既存の表示をそのまま維持する。
  Future<void> refreshFromDailyFeed();
}

/// Web向けのインメモリ実装。ダミーデータ15件を保持しつつ、
/// [refreshFromDailyFeed] で日次フィードの新着記事を追加できる。
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

  @override
  Future<void> refreshFromDailyFeed() async {
    try {
      final fetched = await _feedService.fetchDailyFeed();
      final existingUrls = _articles.map((a) => a.canonicalUrl).toSet();
      final newOnes = fetched.where(
        (a) => !existingUrls.contains(a.canonicalUrl),
      );
      if (newOnes.isEmpty) return;
      _articles = [..._articles, ...newOnes];
      notifyListeners();
    } catch (_) {
      // オフライン等で取得できない場合は既存の表示を維持する。
    }
  }
}
