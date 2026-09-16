import 'package:html/dom.dart';
import 'package:html/parser.dart' as html_parser;

import '../../models/article_candidate.dart';
import 'news_source_parser.dart';

/// 厚生労働省サイト向けのパーサー。
///
/// 注意: このパーサーは実際のページHTMLを直接確認できない環境で書かれた
/// 初版であり、ユーザーから共有されたスクリーンショット・実在の記事リンク
/// 3件（/stf/newpage_NNNNN.html, /stf/kaiken/daijin/xxxxxxxx_xx.html）から
/// 推測したURLパターン・ページ構造に基づいている。実機での動作確認後、
/// 必要に応じてパターンや日付抽出のロジックを調整すること。
class MhlwParser implements NewsSourceParser {
  static final _articleHrefPattern = RegExp(
    r'/stf/(newpage_\d+\.html'
    r'|kaiken/daijin/\d+_\d+\.html'
    r'|houdou/[\w./\-]+\.html'
    r'|shingi2?/[\w./\-]+\.html'
    r'|seisakunitsuite/bunya/[\w./\-]+\.html)$',
  );

  // 「令和8年9月15日」「2026年9月15日」のような和暦・西暦どちらの表記も拾う。
  static final _datePattern = RegExp(r'(令和(\d+)年|(\d{4})年)(\d{1,2})月(\d{1,2})日');

  static const _ignoreTitles = {'NEW', '新着', 'もっと見る', '一覧'};

  @override
  List<ArticleCandidate> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final seenUrls = <String>{};
    final candidates = <ArticleCandidate>[];
    DateTime? currentDate;

    // ドキュメント順（見出し→その配下の記事、という順）に走査し、
    // 直近に見た日付見出しを以降の記事に紐付けていく。
    void visit(Node node) {
      if (node is! Element) return;

      if (node.localName == 'a') {
        _tryAddCandidate(node, base, seenUrls, candidates, currentDate);
        return;
      }

      final ownText = node.nodes.whereType<Text>().map((t) => t.text).join().trim();
      final match = _datePattern.firstMatch(ownText);
      if (match != null) {
        currentDate = _parseDate(match) ?? currentDate;
      }

      for (final child in node.nodes) {
        visit(child);
      }
    }

    visit(document.body ?? document.documentElement ?? document);
    return candidates;
  }

  void _tryAddCandidate(
    Element anchor,
    Uri base,
    Set<String> seenUrls,
    List<ArticleCandidate> candidates,
    DateTime? currentDate,
  ) {
    final href = anchor.attributes['href']?.trim();
    if (href == null || href.isEmpty) return;
    if (!_articleHrefPattern.hasMatch(Uri.parse(href).path)) return;

    final title = anchor.text.trim();
    if (title.isEmpty || _ignoreTitles.contains(title)) return;

    final absoluteUrl = base.resolveUri(Uri.parse(href)).toString();
    if (!seenUrls.add(absoluteUrl)) return;

    candidates.add(ArticleCandidate(title: title, url: absoluteUrl, publishedAt: currentDate));
  }

  DateTime? _parseDate(RegExpMatch match) {
    final year = match.group(2) != null
        ? int.parse(match.group(2)!) + 1988 // 令和N年 → 西暦
        : int.parse(match.group(3)!);
    final month = int.parse(match.group(4)!);
    final day = int.parse(match.group(5)!);
    try {
      return DateTime(year, month, day);
    } catch (_) {
      return null;
    }
  }
}
