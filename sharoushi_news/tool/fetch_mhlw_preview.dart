// 実際のMHLWサイトに対してMhlwParserを動かし、結果をJSONで書き出す検証用
// スクリプト。RSSは使わず、Phase 4と同じ通常のHTTP GET+HTMLパースのみ。
//
// このサンドボックス環境からはmhlw.go.jpへアクセスできないため、
// 実際のネットワークに出られる場所（GitHub Actions等）で実行して初めて
// パーサーの動作を検証できる。
//
// 分野別トピックス一覧ページは古い記事まで含む完全な履歴一覧になっている
// ことが分かっているため、1ページあたり直近 [_maxPerPage] 件に絞る
// （さもないとログ/出力が肥大化し、取得結果を確認できなくなる）。
//
// 使い方: dart run tool/fetch_mhlw_preview.dart
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';

const _maxPerPage = 8;

Future<void> main() async {
  final fetcher = NewsFetcher(parser: MhlwParser());
  final results = <Map<String, Object?>>[];

  for (var i = 0; i < mhlwListingTargets.length; i++) {
    final target = mhlwListingTargets[i];
    stderr.writeln('Fetching ${target.url} ...');
    try {
      final candidates = await fetcher.fetchListing(target.url);
      // publishedAt降順に並べ、直近分だけを残す（ページ自体は日付降順のはずだが念のため）。
      candidates.sort((a, b) => (b.publishedAt ?? DateTime(0)).compareTo(a.publishedAt ?? DateTime(0)));
      final trimmed = candidates.take(_maxPerPage);
      stderr.writeln('  -> ${candidates.length} candidates (showing top $_maxPerPage)');
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
    if (i != mhlwListingTargets.length - 1) {
      await Future.delayed(const Duration(seconds: 2));
    }
  }

  final json = const JsonEncoder.withIndent('  ').convert(results);
  File('fetch-preview-result.json').writeAsStringSync(json);
  // ログでもそのまま確認できるよう、コンソールにも出力する（既に件数を絞っているので肥大化しない）。
  // ignore: avoid_print
  print(json);
}
