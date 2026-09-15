import '../parser/news_source_parser.dart';

/// 記事候補から社労士向け要約を生成するインターフェース（仕様セクション8）。
/// Phase 1〜2では抽象定義のみを置く。AI APIを使う実装は将来ここに追加する。
abstract class ArticleSummarizer {
  Future<ArticleSummary> summarize(ArticleCandidate candidate, String rawText);
}

/// summarize() の戻り値。Article 生成時にそのまま使えるようフィールドを揃える。
class ArticleSummary {
  const ArticleSummary({
    required this.summary,
    required this.practicalImpact,
    required this.importantPoints,
    this.deadline,
    required this.target,
    required this.importance,
    this.isAiGenerated = true,
  });

  final String summary;
  final String practicalImpact;
  final List<String> importantPoints;
  final String? deadline;
  final String target;
  final int importance;
  final bool isAiGenerated;
}
