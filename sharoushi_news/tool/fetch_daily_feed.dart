// GitHub Actions上で1日1回実行され、MHLW・日本年金機構の記事一覧を取得して
// JSON（sharoushi-news-feed/articles.json、GitHub Pages経由でアプリから
// 読み込まれる）として書き出す本番用スクリプト。RSSは使わず、Phase 4と
// 同じ通常のHTTP GET+HTMLパースのみを行う
// （.github/workflows/sharoushi-news-daily-feed.yml から呼び出される）。
//
// ここで生成される記事は、タイトル・URL・日付のみが確実な情報であり、
// 概要・実務影響等はAI要約（Phase 9未実装）ではなく汎用の案内文になる
// （dummy_seed_data.dart の手動キュレーション記事とは別物として扱われる）。
//
// 使い方: dart run tool/fetch_daily_feed.dart [出力先パス]
//   （省略時は ../sharoushi-news-feed/articles.json）
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/models/article_candidate.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';
import 'package:sharoushi_news/services/parser/nenkin_parser.dart';

const _maxTotalArticles = 40;
const _genericSummary = 'この記事はタイトルのみ自動取得されています。詳細は「公式サイトで原文を見る」からご確認ください。';
const _genericPracticalImpact = '実務への影響は原文をご確認ください。';
const _genericTarget = '原文をご確認ください。';

Future<void> main(List<String> args) async {
  final outputPath = args.isNotEmpty
      ? args[0]
      : '../sharoushi-news-feed/articles.json';

  final entries = <Map<String, Object?>>[];
  final seenUrls = <String>{};

  await _fetchAll(
    fetcher: NewsFetcher(parser: MhlwParser()),
    targets: mhlwListingTargets,
    entries: entries,
    seenUrls: seenUrls,
  );
  await _fetchAll(
    fetcher: NewsFetcher(parser: NenkinParser()),
    targets: nenkinListingTargets,
    entries: entries,
    seenUrls: seenUrls,
  );

  entries.sort(
    (a, b) =>
        (b['publishedAt'] as String).compareTo(a['publishedAt'] as String),
  );
  final trimmed = entries.take(_maxTotalArticles).toList();

  final json = const JsonEncoder.withIndent('  ').convert(trimmed);
  final file = File(outputPath);
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(json);
  stderr.writeln('Wrote ${trimmed.length} articles to ${file.path}');
}

Future<void> _fetchAll({
  required NewsFetcher fetcher,
  required List<ListingTarget> targets,
  required List<Map<String, Object?>> entries,
  required Set<String> seenUrls,
}) async {
  for (var i = 0; i < targets.length; i++) {
    final target = targets[i];
    stderr.writeln('Fetching ${target.url} ...');
    try {
      final candidates = await fetcher.fetchListing(target.url);
      for (final c in candidates) {
        if (!seenUrls.add(c.url)) continue;
        entries.add(_toEntry(c, target));
      }
      stderr.writeln('  -> ${candidates.length} candidates');
    } catch (e) {
      stderr.writeln('  -> ERROR: $e');
    }
    if (i != targets.length - 1) {
      await Future.delayed(const Duration(seconds: 2));
    }
  }
}

Map<String, Object?> _toEntry(ArticleCandidate c, ListingTarget target) {
  final now = DateTime.now();
  final publishedAt = c.publishedAt ?? now;
  return {
    'id': c.url,
    'title': c.title,
    'sourceName': target.source.name,
    'sourceUrl': target.source.baseUrl,
    'canonicalUrl': c.url,
    'publishedAt': publishedAt.toIso8601String(),
    'fetchedAt': now.toIso8601String(),
    'category': target.defaultCategory.name,
    'summary': _genericSummary,
    'practicalImpact': _genericPracticalImpact,
    'target': _genericTarget,
    'importance': 1,
  };
}
