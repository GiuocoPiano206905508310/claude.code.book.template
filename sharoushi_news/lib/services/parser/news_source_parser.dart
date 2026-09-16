import '../../models/article_candidate.dart';

/// サイトごとのHTML解析を担うパーサーの共通インターフェース
/// （仕様: NewsSourceParser）。サイトのHTML構造が変わった場合は、この
/// インターフェースを実装するクラス側だけを直せばよいようにする。
abstract class NewsSourceParser {
  List<ArticleCandidate> parse(String html, String pageUrl);
}
