import 'package:html/dom.dart';
import 'package:html/parser.dart' as html_parser;

import '../../core/utils/text_sanitizer.dart';
import '../../models/article_candidate.dart';
import 'news_source_parser.dart';

/// 厚生労働省サイト向けのパーサー。
///
/// GitHub Actions経由で実際のサイトに対して検証した結果、ページの種類ごとに
/// 日付の出し方が異なることが分かっている:
/// - 新着情報ページ（/stf/new-info/）: 日付は見出し（例:「2026年9月15日（火）掲載」）
///   としてリンクの外側にあり、複数のリンクをまとめる。
/// - 分野別トピックス一覧ページ（/stf/seisakunitsuite/bunya/topics_*.html）:
///   日付はリンクの文字列自体の先頭に「YYYY年M月D日掲載」の形で埋め込まれている。
///   また、同じページには日付を持たない一般的な案内リンク（サイドバー等）も
///   混在しているため、日付を検出できなかった候補は誤検出として除外する。
class MhlwParser implements NewsSourceParser {
  static final _articleHrefPattern = RegExp(
    r'/stf/(newpage_\d+\.html'
    r'|kaiken/daijin/\d+_\d+\.html'
    r'|houdou/[\w./\-]+\.html'
    r'|shingi2?/[\w./\-]+\.html'
    r'|seisakunitsuite/bunya/[\w./\-]+\.html)$'
    // 人事労務マガジン（コラム・連載記事）。
    r'|/web_magazine/(column|series)/[\w./\-]+\.html$'
    // パンフレット等のPDF（/content/配下に置かれることが多い）。
    r'|/content/[\w./\-]+\.pdf$',
  );

  // 「令和8年9月15日」「2026年9月15日」のような和暦・西暦どちらの表記も拾う。
  static final _datePattern = RegExp(
    r'(令和(\d+)年|(\d{4})年)(\d{1,2})月(\d{1,2})日',
  );

  // リンク文字列の先頭に埋め込まれた「YYYY年M月D日掲載」「YYYY年M月D日更新」を
  // 日付部分とタイトル部分に分離するためのパターン。
  static final _leadingDatePrefix = RegExp(
    r'^((?:令和\d+年|\d{4}年)\d{1,2}月\d{1,2}日)(?:更新|掲載)?\s*',
  );

  static const _ignoreTitles = {'NEW', '新着', 'もっと見る', '一覧'};

  // 新着情報ページ（/stf/new-info/）のリンクは、カテゴリーラベル（例:「審議会等」
  // 「報道発表」）・本来のタイトル・末尾の「NEW」バッジが、改行区切りの別々の
  // テキストノードとして同じ<a>タグ内に混在している。GitHub Actions上の実データで
  // 確認したところ、タイトルは常に最後の非空行に入っているため、末尾の「NEW」を
  // 除いた最後の行を実際のタイトルとして採用する。

  @override
  List<ArticleCandidate> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final seenUrls = <String>{};
    final candidates = <ArticleCandidate>[];
    DateTime? headingDate;

    // ドキュメント順（見出し→その配下の記事、という順）に走査し、
    // 直近に見た日付見出しを以降の記事に紐付けていく。
    void visit(Node node) {
      if (node is! Element) return;

      if (node.localName == 'a') {
        _tryAddCandidate(node, base, seenUrls, candidates, headingDate);
        return;
      }

      final ownText = node.nodes
          .whereType<Text>()
          .map((t) => t.text)
          .join()
          .trim();
      final match = _datePattern.firstMatch(ownText);
      if (match != null) {
        headingDate = _parseDate(match) ?? headingDate;
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
    DateTime? headingDate,
  ) {
    final href = anchor.attributes['href']?.trim();
    if (href == null || href.isEmpty) return;
    if (!_articleHrefPattern.hasMatch(Uri.parse(href).path)) return;

    final rawText = anchor.text.trim();
    if (rawText.isEmpty) return;

    DateTime? publishedAt = headingDate;
    var title = rawText;
    final prefixMatch = _leadingDatePrefix.matchAsPrefix(rawText);
    if (prefixMatch != null) {
      final dateMatch = _datePattern.firstMatch(prefixMatch.group(1)!);
      if (dateMatch != null) publishedAt = _parseDate(dateMatch) ?? publishedAt;
      title = rawText.substring(prefixMatch.end).trim();
    }
    title = sanitizeScrapedText(_cleanTitle(title));

    if (title.isEmpty || _ignoreTitles.contains(title)) return;
    // 日付を特定できないリンクは、サイドバーの案内リンク等である可能性が高いため除外する。
    if (publishedAt == null) return;

    final absoluteUrl = base.resolveUri(Uri.parse(href)).toString();
    if (!seenUrls.add(absoluteUrl)) return;

    candidates.add(
      ArticleCandidate(
        title: title,
        url: absoluteUrl,
        publishedAt: publishedAt,
      ),
    );
  }

  String _cleanTitle(String raw) {
    final lines = raw
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.isNotEmpty && lines.last == 'NEW') {
      lines.removeLast();
    }
    return lines.isEmpty ? '' : lines.last;
  }

  DateTime? _parseDate(RegExpMatch match) {
    final year = match.group(2) != null
        ? int.parse(match.group(2)!) +
              1988 // 令和N年 → 西暦
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
