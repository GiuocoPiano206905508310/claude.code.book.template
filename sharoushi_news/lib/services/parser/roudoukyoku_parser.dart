import 'package:html/dom.dart';
import 'package:html/parser.dart' as html_parser;

import '../../core/utils/official_date.dart';
import '../../core/utils/text_sanitizer.dart';
import '../../models/article_candidate.dart';
import 'news_source_parser.dart';

/// 都道府県労働局サイト（jsite.mhlw.go.jp）の一覧ページ用パーサー。
///
/// GitHub Actions上で全47局のトップページ・助成金ページを取得して確認した
/// ところ、日付の載せ方は主に次の2通りだった。
///   - トップページの新着一覧: リンク文字列の先頭に日付
///     （例:「2026年09月29日 【死亡災害速報】… NEW」）
///   - 助成金ページの新着情報: 表の行で、日付とリンクが別のセル
///     （例: <tr><td>2026年10月1日</td><td><a>…申立書を公表しました</a></td></tr>）
/// いずれにも対応するため、リンクを含む行・項目の中でリンク以外の部分にある
/// 日付を優先し、無ければリンク先頭の日付を使う。タイトル中の日付
/// （「令和8年10月1日より…」等）は公表日として扱わない。日付が取れない
/// リンク（メニュー・バナー等）は対象外とする。
class RoudoukyokuParser implements NewsSourceParser {
  static const _rowTags = {'tr', 'li', 'dd', 'dt', 'p'};
  static const _chromeClassHints = ['m-header', 'm-nav', 'm-footer', 'Breadcrumb', 'm-listBanner'];
  static final _allowedPath = RegExp(r'(\.html?|\.pdf|/)$', caseSensitive: false);
  static final _trailingNew = RegExp(r'\s*NEW\s*$');

  @override
  List<ArticleCandidate> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final seen = <String>{};
    final candidates = <ArticleCandidate>[];

    for (final anchor in document.querySelectorAll('a')) {
      final href = anchor.attributes['href']?.trim();
      if (href == null || href.isEmpty || href.startsWith('#') || href.startsWith('javascript')) {
        continue;
      }
      if (_isSiteChrome(anchor)) continue;

      final Uri url;
      try {
        url = base.resolveUri(Uri.parse(href)).removeFragment();
      } catch (_) {
        continue;
      }
      if (!url.host.endsWith('mhlw.go.jp') || !_allowedPath.hasMatch(url.path)) continue;

      final anchorText = _collapse(anchor.text);
      if (anchorText.isEmpty) continue;

      var title = anchorText;
      var date = _dateOutsideAnchor(anchor, anchorText);
      if (date == null) {
        final leading = leadingJapaneseDate(anchorText);
        if (leading != null) {
          date = leading.date;
          title = leading.rest;
        }
      }
      title = sanitizeScrapedText(title.replaceFirst(_trailingNew, '').trim());
      if (date == null || title.isEmpty) continue;

      final absolute = url.toString();
      if (!seen.add(absolute)) continue;
      candidates.add(ArticleCandidate(title: title, url: absolute, publishedAt: date));
    }
    return candidates;
  }

  /// リンクを含む行（表の行・リスト項目等）のうち、リンク以外の部分にある日付。
  /// 定義リスト（<dt>日付</dt><dd>リンク</dd>）のように日付が直前の兄弟要素に
  /// ある場合も拾う。
  DateTime? _dateOutsideAnchor(Element anchor, String anchorText) {
    Element? row = anchor.parent;
    while (row != null && !_rowTags.contains(row.localName)) {
      row = row.parent;
    }
    if (row == null) return null;
    final rest = _collapse(row.text).replaceFirst(anchorText, ' ');
    final inRow = firstJapaneseDate(rest);
    if (inRow != null) return inRow;
    final previous = row.previousElementSibling;
    if (previous != null && previous.localName == 'dt') {
      return firstJapaneseDate(previous.text);
    }
    return null;
  }

  bool _isSiteChrome(Element anchor) {
    for (Element? e = anchor.parent; e != null; e = e.parent) {
      final name = e.localName;
      if (name == 'header' || name == 'nav' || name == 'footer') return true;
      final cls = e.attributes['class'] ?? '';
      if (_chromeClassHints.any(cls.contains)) return true;
    }
    return false;
  }

  String _collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();
}
