import 'package:html/parser.dart' as html_parser;

import '../../core/utils/text_sanitizer.dart';
import '../../models/article_candidate.dart';
import 'news_source_parser.dart';

/// 日本年金機構サイト向けのパーサー。
///
/// 注意: ユーザーから共有された実在の記事URL1件
/// （/oshirase/taisetu/kojin/2026/202604/0401.html）から推測した
/// URLパターンに基づく初版。このサイトは日付が年・年月・日の3階層で
/// URLパス自体に埋め込まれているため、日付はHTML構造ではなくURLから
/// 直接復元できる。実機での動作確認後、必要に応じて調整すること。
class NenkinParser implements NewsSourceParser {
  static final _articleHrefPattern = RegExp(
    r'/oshirase/taisetu/(?:kojin|jigyosho)/(\d{4})/(\d{6})/(\d{4})\.html$',
  );

  @override
  List<ArticleCandidate> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final seenUrls = <String>{};
    final candidates = <ArticleCandidate>[];

    for (final anchor in document.querySelectorAll('a[href]')) {
      final href = anchor.attributes['href']?.trim();
      if (href == null || href.isEmpty) continue;
      final match = _articleHrefPattern.firstMatch(Uri.parse(href).path);
      if (match == null) continue;

      final title = sanitizeScrapedText(anchor.text.trim());
      if (title.isEmpty) continue;

      final absoluteUrl = base.resolveUri(Uri.parse(href)).toString();
      if (!seenUrls.add(absoluteUrl)) continue;

      candidates.add(
        ArticleCandidate(
          title: title,
          url: absoluteUrl,
          publishedAt: _dateFromPath(match),
        ),
      );
    }
    return candidates;
  }

  DateTime? _dateFromPath(RegExpMatch match) {
    final year = int.parse(match.group(1)!);
    final monthDay = match.group(3)!; // 例: "0401"
    if (monthDay.length != 4) return null;
    final month = int.parse(monthDay.substring(0, 2));
    final day = int.parse(monthDay.substring(2, 4));
    try {
      return DateTime(year, month, day);
    } catch (_) {
      return null;
    }
  }
}
