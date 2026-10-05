import 'package:html/dom.dart';
import 'package:html/parser.dart' as html_parser;

import '../../core/utils/official_date.dart';
import '../../core/utils/text_sanitizer.dart';

/// 監視対象ページ（制度ごとの解説ページ等）に載っているリンク1件。
class WatchedLink {
  const WatchedLink({required this.url, required this.title, this.date});

  final String url;
  final String title;

  /// リンクと同じ行・項目に書かれた掲載日等。無ければnull。
  final DateTime? date;
}

/// 厚生労働省の制度別ページ（例:「いわゆる『シフト制』について」）から、
/// 資料・関連ページへのリンクを抜き出す。
///
/// 新しいリーフレット等は新着一覧に載らず、既存の制度ページにリンクが
/// 追加されるだけのことがある（実例:「『シフト制』で働く場合の年次有給
/// 休暇について」のリーフレット）。前回の実行時と比べて新しく増えた
/// リンクを記事として扱うために使う（比較はfetch_daily_feed.dart側）。
class WatchedPageParser {
  WatchedPageParser({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;

  static const _rowTags = {'tr', 'li', 'dd', 'p'};
  static const _chromeClassHints = ['m-header', 'm-nav', 'm-footer', 'breadcrumb', 'm-listbanner'];
  static final _allowedPath = RegExp(r'\.(html?|pdf)$', caseSensitive: false);
  // 「［756KB］」「（PDF：1.2MB）」「[PDF形式：720KB]」等のファイル情報。
  static final _fileInfo = RegExp(
    r'\s*[［\[（(]\s*(?:PDF[^］\]）)]*?)?[0-9.,]+\s*[KMG]B\s*[］\]）)]',
    caseSensitive: false,
  );
  // 「専門業務型裁量労働制 PDF 令和５年11月」のような、単独の「PDF」表記。
  static final _pdfLabel = RegExp(r'(?<=^|\s)PDF(?=\s|$)');
  // 「開く」「こちら」等、リンク文字列だけでは内容が分からないもの。
  // この場合は同じ行（表の行等）の文字列をタイトルにする。
  static final _genericText = RegExp(
    r'^(?:開く|こちら|ここ|PDF|ダウンロード|詳細|詳しくはこちら|リンク|別ウィンドウ)?$',
    caseSensitive: false,
  );

  List<WatchedLink> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final jst = _now().toUtc().add(const Duration(hours: 9));
    final today = DateTime(jst.year, jst.month, jst.day);
    final seen = <String>{};
    final links = <WatchedLink>[];

    for (final anchor in document.querySelectorAll('a')) {
      final href = anchor.attributes['href']?.trim();
      if (href == null || href.isEmpty || href.startsWith('#')) continue;
      if (_isSiteChrome(anchor)) continue;

      final Uri url;
      try {
        url = base.resolveUri(Uri.parse(href)).removeFragment();
      } catch (_) {
        continue;
      }
      if (!url.host.endsWith('mhlw.go.jp') || !_allowedPath.hasMatch(url.path)) continue;
      if (url.path == base.path) continue;

      final anchorText = _textOf(anchor);
      final row = _row(anchor);
      final rowText = row == null ? '' : _textOf(row);
      final rest = anchorText.isEmpty ? rowText : rowText.replaceFirst(anchorText, ' ');

      var title = _stripFileInfo(anchorText);
      if (_genericText.hasMatch(title)) title = _stripFileInfo(_collapse(rest));
      title = sanitizeScrapedText(title);
      if (title.isEmpty || _genericText.hasMatch(title)) continue;

      var date = firstJapaneseDate(rest);
      if (date != null && date.isAfter(today)) date = null;

      if (!seen.add(url.toString())) continue;
      links.add(WatchedLink(url: url.toString(), title: title, date: date));
    }
    return links;
  }

  Element? _row(Element anchor) {
    for (Element? e = anchor.parent; e != null; e = e.parent) {
      if (_rowTags.contains(e.localName)) return e;
    }
    return null;
  }

  bool _isSiteChrome(Element anchor) {
    for (Element? e = anchor.parent; e != null; e = e.parent) {
      final name = e.localName;
      if (name == 'header' || name == 'nav' || name == 'footer') return true;
      final cls = (e.attributes['class'] ?? '').toLowerCase();
      if (_chromeClassHints.any(cls.contains)) return true;
    }
    return false;
  }

  /// 要素内のテキストを、表のセル等の境界で詰まらないよう空白区切りで連結する。
  String _textOf(Element element) {
    final parts = <String>[];
    void visit(Node node) {
      if (node is Text) {
        parts.add(node.text);
      } else {
        node.nodes.forEach(visit);
      }
    }

    visit(element);
    return _collapse(parts.join(' '));
  }

  String _stripFileInfo(String s) =>
      _collapse(s.replaceAll(_fileInfo, '').replaceAll(_pdfLabel, ' '));

  String _collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();
}
