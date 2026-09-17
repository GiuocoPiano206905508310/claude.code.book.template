/// 記事1件分のデータモデル（仕様セクション18準拠）。
///
/// Phase 1〜2ではダミーデータのみを保持する。取得元サイトの本文全体は
/// 保持しない方針のため、summary 等は要約済みの短いテキストのみを持つ。
class Article {
  const Article({
    required this.id,
    required this.title,
    required this.sourceName,
    required this.sourceUrl,
    required this.canonicalUrl,
    required this.publishedAt,
    this.updatedAt,
    required this.fetchedAt,
    required this.category,
    required this.summary,
    required this.practicalImpact,
    required this.importantPoints,
    this.deadline,
    required this.target,
    required this.importance,
    this.isRead = false,
    this.isFavorite = false,
    required this.contentHash,
    this.isAiGenerated = true,
  });

  final String id;
  final String title;
  final String sourceName;
  final String sourceUrl;

  /// 重複記事の判定に用いる正規化済みURL。
  final String canonicalUrl;

  final DateTime publishedAt;
  final DateTime? updatedAt;
  final DateTime fetchedAt;

  final NewsCategory category;

  /// 【概要】100〜200文字程度の要約。
  final String summary;

  /// 【社労士実務への影響】
  final String practicalImpact;

  /// 【重要ポイント】最大3〜5項目。
  final List<String> importantPoints;

  /// 【対応期限】存在する場合のみ。
  final String? deadline;

  /// 【対象】例: 全企業 / 従業員50人以上 など。
  final String target;

  /// 重要度 1〜3（3が最も重要）。
  final int importance;

  final bool isRead;
  final bool isFavorite;

  /// 変更検出用のハッシュ（Phase4以降で利用）。
  final String contentHash;

  /// この要約がAIまたは自動処理によって生成されたものかどうか。
  final bool isAiGenerated;

  Article copyWith({bool? isRead, bool? isFavorite}) {
    return Article(
      id: id,
      title: title,
      sourceName: sourceName,
      sourceUrl: sourceUrl,
      canonicalUrl: canonicalUrl,
      publishedAt: publishedAt,
      updatedAt: updatedAt,
      fetchedAt: fetchedAt,
      category: category,
      summary: summary,
      practicalImpact: practicalImpact,
      importantPoints: importantPoints,
      deadline: deadline,
      target: target,
      importance: importance,
      isRead: isRead ?? this.isRead,
      isFavorite: isFavorite ?? this.isFavorite,
      contentHash: contentHash,
      isAiGenerated: isAiGenerated,
    );
  }
}

/// ホーム画面のカテゴリー横スクロールに対応する分類。
enum NewsCategory {
  lawChange('法改正'),
  pamphlet('パンフレット'),
  labor('労働'),
  socialInsurance('社会保険'),
  employmentInsurance('雇用保険'),
  subsidy('助成金'),
  pension('年金');

  const NewsCategory(this.label);

  final String label;
}
