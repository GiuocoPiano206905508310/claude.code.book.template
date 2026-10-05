// 一時的な診断用スクリプト（PR作成前に削除）。監視対象ページから実際に
// 抜き出されるリンクを確認する。
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/watched_page_parser.dart';

Future<void> main() async {
  final out = StringBuffer('# watched pages diag ${DateTime.now().toIso8601String()}\n');
  final parser = WatchedPageParser();
  for (final page in watchedPages) {
    out.writeln('\n## $page');
    try {
      final r = await http.get(Uri.parse(page), headers: const {'User-Agent': NewsFetcher.userAgent});
      final links = parser.parse(utf8.decode(r.bodyBytes, allowMalformed: true), page);
      out.writeln('status=${r.statusCode} links=${links.length}');
      for (final l in links.take(40)) {
        out.writeln('- ${l.date?.toIso8601String().substring(0, 10) ?? '----------'} ${l.title.length > 90 ? l.title.substring(0, 90) : l.title} <${l.url}>');
      }
    } catch (e) {
      out.writeln('ERROR $e');
    }
    await Future.delayed(const Duration(seconds: 1));
  }
  final file = File('diag/mhlw.md');
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(out.toString());
}
