import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../../models/article.dart';

/// ローカルSQLiteデータベース（Phase 3〜）。
///
/// Phase 1〜2のダミーデータをそのまま初回シードとして使い、Phase 4以降で
/// 実データ取得を実装した際にはこのテーブルへ upsert していく想定。
/// 記事本文全体は保持しない方針のため、保存するのはあくまで要約済みの
/// フィールドのみ（[Article] モデルと同じ範囲）。
class AppDatabase {
  AppDatabase._(this._db);

  final Database _db;

  static const _tableArticles = 'articles';

  static Future<AppDatabase> open() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'sharoushi_news.db');
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableArticles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            sourceName TEXT NOT NULL,
            sourceUrl TEXT NOT NULL,
            canonicalUrl TEXT NOT NULL,
            publishedAt INTEGER NOT NULL,
            updatedAt INTEGER,
            fetchedAt INTEGER NOT NULL,
            category TEXT NOT NULL,
            summary TEXT NOT NULL,
            practicalImpact TEXT NOT NULL,
            importantPoints TEXT NOT NULL,
            deadline TEXT,
            target TEXT NOT NULL,
            importance INTEGER NOT NULL,
            isRead INTEGER NOT NULL DEFAULT 0,
            isFavorite INTEGER NOT NULL DEFAULT 0,
            contentHash TEXT NOT NULL,
            isAiGenerated INTEGER NOT NULL DEFAULT 1
          )
        ''');
      },
    );
    return AppDatabase._(db);
  }

  Future<List<Article>> getAllArticles() async {
    final rows = await _db.query(_tableArticles);
    return rows.map(_rowToArticle).toList();
  }

  Future<int> countArticles() async {
    final result = await _db.rawQuery(
      'SELECT COUNT(*) AS c FROM $_tableArticles',
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<void> upsertArticles(List<Article> articles) async {
    final batch = _db.batch();
    for (final article in articles) {
      batch.insert(
        _tableArticles,
        _articleToRow(article),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> setFavorite(String id, bool value) async {
    await _db.update(
      _tableArticles,
      {'isFavorite': value ? 1 : 0},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> setRead(String id, bool value) async {
    await _db.update(
      _tableArticles,
      {'isRead': value ? 1 : 0},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Map<String, Object?> _articleToRow(Article a) {
    return {
      'id': a.id,
      'title': a.title,
      'sourceName': a.sourceName,
      'sourceUrl': a.sourceUrl,
      'canonicalUrl': a.canonicalUrl,
      'publishedAt': a.publishedAt.millisecondsSinceEpoch,
      'updatedAt': a.updatedAt?.millisecondsSinceEpoch,
      'fetchedAt': a.fetchedAt.millisecondsSinceEpoch,
      'category': a.category.name,
      'summary': a.summary,
      'practicalImpact': a.practicalImpact,
      'importantPoints': jsonEncode(a.importantPoints),
      'deadline': a.deadline,
      'target': a.target,
      'importance': a.importance,
      'isRead': a.isRead ? 1 : 0,
      'isFavorite': a.isFavorite ? 1 : 0,
      'contentHash': a.contentHash,
      'isAiGenerated': a.isAiGenerated ? 1 : 0,
    };
  }

  Article _rowToArticle(Map<String, Object?> row) {
    return Article(
      id: row['id'] as String,
      title: row['title'] as String,
      sourceName: row['sourceName'] as String,
      sourceUrl: row['sourceUrl'] as String,
      canonicalUrl: row['canonicalUrl'] as String,
      publishedAt: DateTime.fromMillisecondsSinceEpoch(
        row['publishedAt'] as int,
      ),
      updatedAt: row['updatedAt'] == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(row['updatedAt'] as int),
      fetchedAt: DateTime.fromMillisecondsSinceEpoch(row['fetchedAt'] as int),
      category: NewsCategory.values.byName(row['category'] as String),
      summary: row['summary'] as String,
      practicalImpact: row['practicalImpact'] as String,
      importantPoints: (jsonDecode(row['importantPoints'] as String) as List)
          .cast<String>(),
      deadline: row['deadline'] as String?,
      target: row['target'] as String,
      importance: row['importance'] as int,
      isRead: (row['isRead'] as int) == 1,
      isFavorite: (row['isFavorite'] as int) == 1,
      contentHash: row['contentHash'] as String,
      isAiGenerated: (row['isAiGenerated'] as int) == 1,
    );
  }
}
