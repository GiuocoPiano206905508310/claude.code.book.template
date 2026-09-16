/// 一覧ページのパース直後、まだ [Article] に整形される前の中間データ
/// （仕様セクションのレイヤー構成: Fetcher→Parser→ArticleCandidate→…）。
///
/// タイトルとリンクのみが確実な情報で、概要・実務影響・重要ポイント等の
/// 分析的なフィールドはAI要約（Phase 9〜）が実装されるまでは持たない。
class ArticleCandidate {
  const ArticleCandidate({
    required this.title,
    required this.url,
    this.publishedAt,
  });

  final String title;
  final String url;
  final DateTime? publishedAt;
}
