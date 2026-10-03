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
///
/// 実サイトでの確認結果から、次のものも除外する。
///   - 今日（日本時間）より後の日付: 申請期限・施行日等であり公表日ではない
///     （例: 助成金コース一覧の行にある「2026年11月30日」締切）
///   - 「詳細はこちら」「最低賃金の詳細」等、リンク文字列だけでは内容が
///     分からないもの
///   - 多数のリンクをまとめた段落・項目の日付: 個々の記事の公表日ではなく
///     ページ全体の更新日であることが多い
class RoudoukyokuParser implements NewsSourceParser {
  RoudoukyokuParser({DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DateTime Function() _now;

  static const _rowTags = {'tr', 'li', 'dd', 'dt', 'p'};
  static const _chromeClassHints = ['m-header', 'm-nav', 'm-footer', 'Breadcrumb', 'm-listBanner'];
  static const _maxAnchorsPerRow = 2;
  static final _allowedPath = RegExp(r'(\.html?|\.pdf|/)$', caseSensitive: false);
  static final _trailingNew = RegExp(r'\s*NEW\s*$');
  // 先頭の日付の直後がこれらで始まる場合、その日付は文の一部
  // （「令和8年5月1日以降の紹介より…」「6月29日（月）から…」）であり
  // 公表日ではない。
  static final _sentenceContinuation = RegExp(r'^(?:[（(〜～~\-－]|から|より|以降|以後|まで|の|に|を|付け?|現在|時点)');
  static final _genericTitle = RegExp(
    r'^(?:詳細|詳しく|こちら|特設ページ|リンク|ダウンロード)|(?:の詳細|はこちら|をクリック)$',
  );

  @override
  List<ArticleCandidate> parse(String html, String pageUrl) {
    final document = html_parser.parse(html);
    final base = Uri.parse(pageUrl);
    final seen = <String>{};
    final candidates = <ArticleCandidate>[];
    // 実行環境（GitHub ActionsはUTC）によらず、日本時間の今日を基準にする。
    final jst = _now().toUtc().add(const Duration(hours: 9));
    final today = DateTime(jst.year, jst.month, jst.day);

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
        if (leading != null && !_sentenceContinuation.hasMatch(leading.rest)) {
          date = leading.date;
          title = leading.rest;
        }
      }
      title = sanitizeScrapedText(title.replaceFirst(_trailingNew, '').trim());
      if (date == null || title.isEmpty) continue;
      if (date.isAfter(today) || _genericTitle.hasMatch(title)) continue;

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
    if (row.querySelectorAll('a').length > _maxAnchorsPerRow) return null;
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
