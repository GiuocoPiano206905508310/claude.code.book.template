/// 日付表示用の軽量フォーマッタ（intl 等の追加パッケージは使わない）。
String formatYmd(DateTime date) => '${date.year}/${date.month}/${date.day}';

/// 記事一覧・検索結果向けの相対表現つき短縮表示。
String formatArticleDate(DateTime date, {DateTime? now}) {
  final today = now ?? DateTime.now();
  final diff = DateTime(
    today.year,
    today.month,
    today.day,
  ).difference(DateTime(date.year, date.month, date.day)).inDays;
  if (diff == 0) return '本日';
  if (diff == 1) return '昨日';
  return formatYmd(date);
}
