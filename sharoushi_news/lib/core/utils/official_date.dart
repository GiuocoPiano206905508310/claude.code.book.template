import 'package:html/parser.dart' as html_parser;

/// 公式サイトのページから「公表日」を読み取るためのユーティリティ。
///
/// 本文中で「公表日」「掲載日」等とラベル付けされた日付だけを対象にし、
/// 施行日など本文中の他の日付を誤って拾わないようにする。優先順位は
/// 公表・掲載・発表日 → メタタグの公開日 → 更新日。

const _ymd =
    r'(?:令和\s*(\d{1,2}|元)\s*年|(\d{4})\s*年)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日';

final _publishedLabelBefore = RegExp('(?:公表|掲載|発表|公開)日?\\s*[：:]?\\s*$_ymd');
final _publishedLabelAfter = RegExp('$_ymd\\s*(?:公表|掲載|発表)');
final _updatedLabelBefore = RegExp('(?:最終)?更新日?\\s*[：:]?\\s*$_ymd');
final _updatedLabelAfter = RegExp('$_ymd\\s*更新');
final _isoDate = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})');

const _publishedMetaSelectors = [
  'meta[property="article:published_time"]',
  'meta[name="dcterms.issued"]',
  'meta[name="DC.date"]',
  'meta[name="date"]',
];

/// [html]から公表日を読み取る。見つからない場合、または未来の日付しか
/// 見つからない場合はnull。
DateTime? extractOfficialDate(String html, {DateTime? now}) {
  final today = now ?? DateTime.now();
  bool plausible(DateTime d) =>
      d.year >= 2000 && !d.isAfter(today.add(const Duration(days: 1)));

  final document = html_parser.parse(html);
  final text = normalizeDigits(
    (document.body?.text ?? '').replaceAll(RegExp(r'\s+'), ' '),
  );

  DateTime? firstLabeled(List<RegExp> patterns) {
    for (final pattern in patterns) {
      for (final match in pattern.allMatches(text)) {
        final date = _fromYmdMatch(match);
        if (date != null && plausible(date)) return date;
      }
    }
    return null;
  }

  final published = firstLabeled([_publishedLabelBefore, _publishedLabelAfter]);
  if (published != null) return published;

  for (final selector in _publishedMetaSelectors) {
    final content = document.querySelector(selector)?.attributes['content'];
    final match = content == null ? null : _isoDate.firstMatch(content.trim());
    if (match == null) continue;
    final date = _safeDate(
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3)!),
    );
    if (date != null && plausible(date)) return date;
  }

  return firstLabeled([_updatedLabelBefore, _updatedLabelAfter]);
}

/// 全角数字（０〜９）を半角に変換する。
String normalizeDigits(String text) => text.replaceAllMapped(
  RegExp('[０-９]'),
  (m) => String.fromCharCode(m[0]!.codeUnitAt(0) - 0xFF10 + 0x30),
);

DateTime? _fromYmdMatch(RegExpMatch match) {
  final reiwa = match.group(1);
  final year = reiwa != null
      ? (reiwa == '元' ? 1 : int.parse(reiwa)) + 2018
      : int.parse(match.group(2)!);
  return _safeDate(year, int.parse(match.group(3)!), int.parse(match.group(4)!));
}

DateTime? _safeDate(int year, int month, int day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  final date = DateTime(year, month, day);
  // 2月30日のような存在しない日付は DateTime が繰り上げてしまうため弾く。
  return date.month == month ? date : null;
}
