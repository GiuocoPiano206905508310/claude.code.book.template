import '../core/database/app_database.dart';
import '../models/article.dart';
import 'article_repository.dart';
import 'dummy_seed_data.dart';

/// ローカルDB（SQLite）を使う実装（Phase 3〜）。
///
/// 初回起動時はテーブルが空のため、Phase 1〜2と同じダミーデータ15件を
/// シードする。以降はDBの内容が唯一の情報源となり、お気に入り・既読状態は
/// アプリを再起動しても保持される。Phase 4以降で実データ取得を実装する際は、
/// このリポジトリの [_db] へ upsert するだけで置き換えられる想定。
class LocalArticleRepository extends ArticleRepository {
  LocalArticleRepository._(this._db, this._articles);

  final AppDatabase _db;
  List<Article> _articles;

  static Future<LocalArticleRepository> create(AppDatabase db) async {
    if (await db.countArticles() == 0) {
      await db.upsertArticles(buildSeedArticles());
    }
    final articles = await db.getAllArticles();
    return LocalArticleRepository._(db, articles);
  }

  @override
  List<Article> get articles => List.unmodifiable(_articles);

  @override
  Future<void> toggleFavorite(String id) async {
    final target = _articles.firstWhere((a) => a.id == id);
    final newValue = !target.isFavorite;
    await _db.setFavorite(id, newValue);
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isFavorite: newValue) else a,
    ];
    notifyListeners();
  }

  @override
  Future<void> markAsRead(String id) async {
    final target = _articles.firstWhere((a) => a.id == id);
    if (target.isRead) return;
    await _db.setRead(id, true);
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isRead: true) else a,
    ];
    notifyListeners();
  }
}
