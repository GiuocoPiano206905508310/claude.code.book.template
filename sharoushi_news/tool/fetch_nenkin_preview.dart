// 実際の日本年金機構サイトに対してNenkinParserを動かし、結果をJSONで
// 書き出す検証用スクリプト。RSSは使わず、通常のHTTP GET+HTMLパースのみ。
//
// このサンドボックス環境からはnenkin.go.jpへアクセスできないため、
// 実際のネットワークに出られる場所（GitHub Actions等）で実行して初めて
// パーサーの動作を検証できる。
//
// 使い方: dart run tool/fetch_nenkin_preview.dart
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/nenkin_parser.dart';

const _maxPerPage = 10;

Future<void> main() async {
  final fetcher = NewsFetcher(parser: NenkinParser());
  final results = <Map<String, Object?>>[];

  for (var i = 0; i < nenkinListingTargets.length; i++) {
    final target = nenkinListingTargets[i];
    stderr.writeln('Fetching ${target.url} ...');
    try {
      final candidates = await fetcher.fetchListing(target.url);
      candidates.sort(
        (a, b) => (b.publishedAt ?? DateTime(0)).compareTo(
          a.publishedAt ?? DateTime(0),
        ),
      );
      final trimmed = candidates.take(_maxPerPage);
      stderr.writeln(
        '  -> ${candidates.length} candidates (showing top $_maxPerPage)',
      );
      for (final c in trimmed) {
        results.add({
          'listingUrl': target.url,
          'defaultCategory': target.defaultCategory.name,
          'title': c.title,
          'url': c.url,
          'publishedAt': c.publishedAt?.toIso8601String(),
        });
      }
    } catch (e) {
      stderr.writeln('  -> ERROR: $e');
      results.add({'listingUrl': target.url, 'error': e.toString()});
    }
    if (i != nenkinListingTargets.length - 1) {
      await Future.delayed(const Duration(seconds: 2));
    }
  }

  final json = const JsonEncoder.withIndent('  ').convert(results);
  File('fetch-preview-result.json').writeAsStringSync(json);
  // ignore: avoid_print
  print(json);
}
