// 実際のMHLWサイトに対してMhlwParserを動かし、結果をJSONで標準出力に流す
// 検証用スクリプト。RSSは使わず、Phase 4と同じ通常のHTTP GET+HTMLパースのみ。
//
// このサンドボックス環境からはmhlw.go.jpへアクセスできないため、
// 実際のネットワークに出られる場所（GitHub Actions等）で実行して初めて
// パーサーの動作を検証できる。
//
// 使い方: dart run tool/fetch_mhlw_preview.dart
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';

Future<void> main() async {
  final fetcher = NewsFetcher(parser: MhlwParser());
  final results = <Map<String, Object?>>[];

  for (var i = 0; i < mhlwListingTargets.length; i++) {
    final target = mhlwListingTargets[i];
    stderr.writeln('Fetching ${target.url} ...');
    try {
      final candidates = await fetcher.fetchListing(target.url);
      stderr.writeln('  -> ${candidates.length} candidates');
      for (final c in candidates) {
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
    if (i != mhlwListingTargets.length - 1) {
      await Future.delayed(const Duration(seconds: 2));
    }
  }

  // ignore: avoid_print
  print(const JsonEncoder.withIndent('  ').convert(results));
}
