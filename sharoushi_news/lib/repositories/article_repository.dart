import 'package:flutter/foundation.dart';

import '../models/article.dart';
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
}

/// Web向けのインメモリ実装。ダミーデータ15件を保持するのみで、
/// 実際のネットワークアクセス・永続化は行わない。
class DummyArticleRepository extends ArticleRepository {
  DummyArticleRepository() : _articles = buildSeedArticles();

  List<Article> _articles;

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
}
