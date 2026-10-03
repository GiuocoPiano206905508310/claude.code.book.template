// 一時的な診断用スクリプト（労働局パーサーの実サイトでの動作確認用）。
// サンドボックスからjsite.mhlw.go.jpに接続できないため、GitHub Actions上で
// 実行し、結果をリポジトリにコミットして確認する。確認後に削除する。
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/roudoukyoku_parser.dart';

// tool/fetch_daily_feed.dart の _subsidyTitlePattern と同じ。
final _subsidy = RegExp(
  r'助成金|奨励金|支給要領|正社員化コース|キャリアアップ|両立支援等|人材開発支援'
  r'|雇用調整|特定求職者雇用開発|トライアル雇用|業務改善|働き方改革推進支援',
);

Future<void> main() async {
  final fetcher = NewsFetcher(parser: RoudoukyokuParser());
  final out = StringBuffer();
  final cutoff = DateTime.now().subtract(const Duration(days: 180));
  final picked = <(DateTime, String, String, String)>[];

  for (final t in roudoukyokuListingTargets) {
    out.writeln('\n## ${t.source.name} ${t.url}');
    try {
      final cands = await fetcher.fetchListing(t.url);
      final kept = cands.where(
        (c) => _subsidy.hasMatch(c.title) && c.publishedAt!.isAfter(cutoff),
      );
      out.writeln('parsed=${cands.length} subsidyRecent=${kept.length}');
      for (final c in cands.take(12)) {
        out.writeln('  all: ${c.publishedAt!.toIso8601String().substring(0, 10)} ${c.title}');
      }
      for (final c in kept) {
        out.writeln('  KEEP: ${c.publishedAt!.toIso8601String().substring(0, 10)} ${c.title} <${c.url}>');
        picked.add((c.publishedAt!, t.source.name, c.title, c.url));
      }
    } catch (e) {
      out.writeln('ERROR: $e');
    }
    await Future.delayed(const Duration(seconds: 1));
  }

  picked.sort((a, b) => b.$1.compareTo(a.$1));
  out.writeln('\n# 採用候補（新しい順、重複除外前 ${picked.length}件）');
  for (final p in picked) {
    out.writeln('- ${p.$1.toIso8601String().substring(0, 10)} [${p.$2}] ${p.$3}');
  }
  final file = File('diag/roudoukyoku.md');
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(out.toString());
  stderr.writeln('wrote ${file.path}');
}
