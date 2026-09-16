import 'package:http/http.dart' as http;

import '../../core/network/news_fetch_exception.dart';
import '../../models/article_candidate.dart';
import '../parser/news_source_parser.dart';

/// 1つの一覧ページを取得し、パーサーに渡すだけの単純なFetcher
/// （仕様のレイヤー構成: Source→Fetcher→Parser→ArticleCandidate）。
///
/// アクセス頻度を抑えるためのリクエスト間隔の制御は、複数の一覧ページを
/// 順に取得する呼び出し側（[NewsSyncService]）の責務とする。
class NewsFetcher {
  NewsFetcher({required this.parser, http.Client? client}) : _client = client ?? http.Client();

  final NewsSourceParser parser;
  final http.Client _client;

  /// 取得元に「個人利用の非公式アプリからのアクセスである」ことが分かるように
  /// 名乗るUser-Agent。RSSは一切使用せず、通常のWebページを都度HTTP GETする。
  static const _userAgent = 'SharoushiNewsApp-Prototype/0.1 (individual use; not for redistribution)';

  Future<List<ArticleCandidate>> fetchListing(String url) async {
    final http.Response response;
    try {
      response = await _client
          .get(Uri.parse(url), headers: const {'User-Agent': _userAgent})
          .timeout(const Duration(seconds: 15));
    } catch (e) {
      throw NewsFetchException('$url の取得に失敗しました: $e');
    }
    if (response.statusCode != 200) {
      throw NewsFetchException('$url が HTTP ${response.statusCode} を返しました');
    }
    return parser.parse(response.body, url);
  }
}
