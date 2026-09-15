/// サイトごとのHTML構造変更を吸収するための共通パーサーインターフェース
/// （仕様セクション5）。Phase 1〜2では抽象定義のみを置き、MhlwParser 等の
/// 具体的な実装（実際のHTML取得・解析）は行わない。
abstract class NewsSourceParser {
  /// 取得済みのHTML文字列から記事候補の一覧を抽出する。
  List<ArticleCandidate> parse(String html);
}

/// パーサーが抽出した、まだ関連性判定・要約前の生の記事候補。
class ArticleCandidate {
  const ArticleCandidate({
    required this.title,
    required this.url,
    this.publishedAt,
    this.updatedAt,
  });

  final String title;
  final String url;
  final DateTime? publishedAt;
  final DateTime? updatedAt;
}
