import '../../core/constants/source_config.dart';
import '../../models/article.dart';
import '../../models/article_candidate.dart';
import '../../repositories/local_article_repository.dart';
import '../parser/mhlw_parser.dart';
import 'news_fetcher.dart';

class NewsSyncResult {
  const NewsSyncResult({required this.newCount, required this.fetchedCount, required this.errors});

  final int newCount;
  final int fetchedCount;
  final List<String> errors;

  bool get hasErrors => errors.isNotEmpty;
}

/// 複数の一覧ページを順番に取得し、ローカルDBへ反映するオーケストレーター。
///
/// 「低頻度アクセス（1日数回程度）」の方針に沿うよう、ページ間には間隔を
/// 空けてリクエストする。バックグラウンド自動実行は行わず、設定画面からの
/// 手動実行のみに限定する（初版のため、実際の挙動をユーザー自身の端末で
/// 確認してもらう必要があるため）。
class NewsSyncService {
  NewsSyncService({required this.repository, NewsFetcher? fetcher})
    : _fetcher = fetcher ?? NewsFetcher(parser: MhlwParser());

  final LocalArticleRepository repository;
  final NewsFetcher _fetcher;

  static const _delayBetweenRequests = Duration(seconds: 2);

  Future<NewsSyncResult> syncMhlw() async {
    final allArticles = <Article>[];
    final errors = <String>[];

    for (var i = 0; i < mhlwListingTargets.length; i++) {
      final target = mhlwListingTargets[i];
      try {
        final candidates = await _fetcher.fetchListing(target.url);
        allArticles.addAll(candidates.map((c) => _toArticle(c, target)));
      } catch (e) {
        errors.add(e.toString());
      }
      if (i != mhlwListingTargets.length - 1) {
        await Future.delayed(_delayBetweenRequests);
      }
    }

    final newCount = await repository.upsertFetched(allArticles);
    return NewsSyncResult(newCount: newCount, fetchedCount: allArticles.length, errors: errors);
  }

  Article _toArticle(ArticleCandidate c, ListingTarget target) {
    final now = DateTime.now();
    return Article(
      id: c.url,
      title: c.title,
      sourceName: target.source.name,
      sourceUrl: target.source.baseUrl,
      canonicalUrl: c.url,
      publishedAt: c.publishedAt ?? now,
      fetchedAt: now,
      category: target.defaultCategory,
      summary: 'この記事はタイトルのみ自動取得されています。詳細は「公式サイトで原文を見る」からご確認ください。',
      practicalImpact: '実務への影響は原文をご確認ください。',
      importantPoints: const [],
      target: '原文をご確認ください。',
      importance: 1,
      contentHash: c.url,
      isAiGenerated: false,
    );
  }
}
