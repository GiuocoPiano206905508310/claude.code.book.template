// 一時的な診断用スクリプト（PR作成前に削除）。厚労省の一覧ページの実際の
// 中身と、「シフト制」リーフレット（001756191.pdf）の掲載場所を確認する。
import 'dart:convert';
import 'dart:io';

import 'package:html/parser.dart' as html_parser;
import 'package:http/http.dart' as http;
import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';

const _ua = 'SharoushiNewsApp-Prototype/0.1 (individual use; not for redistribution)';
const _needle = '001756191';

final _watchPages = [
  'https://www.mhlw.go.jp/stf/newpage_22954.html',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000056460.html',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/index.html',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/roudouzikan/index.html',
];

Future<String> _get(String url) async {
  final r = await http.get(Uri.parse(url), headers: {'User-Agent': _ua});
  return utf8.decode(r.bodyBytes, allowMalformed: true);
}

String _collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();

void _needleContext(StringBuffer out, String html) {
  final doc = html_parser.parse(html);
  for (final a in doc.querySelectorAll('a')) {
    if (!(a.attributes['href'] ?? '').contains(_needle)) continue;
    var row = a.parent;
    for (var i = 0; i < 3 && row?.parent != null; i++) {
      row = row!.parent;
    }
    out.writeln('  NEEDLE anchor="${_collapse(a.text)}" href=${a.attributes['href']}');
    out.writeln('  NEEDLE context: ${_collapse(row?.text ?? '').characters300}');
  }
}

extension on String {
  String get characters300 => length > 600 ? substring(0, 600) : this;
}

Future<void> main() async {
  final out = StringBuffer('# MHLW diag ${DateTime.now().toIso8601String()}\n');
  final parser = MhlwParser();
  for (final t in mhlwListingTargets) {
    out.writeln('\n## LISTING ${t.url}');
    try {
      final html = await _get(t.url);
      final cands = parser.parse(html, t.url);
      out.writeln('parsed=${cands.length} containsNeedle=${html.contains(_needle)}');
      _needleContext(out, html);
      for (final c in cands) {
        out.writeln('- ${c.publishedAt?.toIso8601String().substring(0, 10)} ${c.title} <${c.url}>');
      }
    } catch (e) {
      out.writeln('ERROR $e');
    }
    await Future.delayed(const Duration(seconds: 1));
  }
  for (final url in _watchPages) {
    out.writeln('\n## WATCH $url');
    try {
      final html = await _get(url);
      final doc = html_parser.parse(html);
      out.writeln('title=${_collapse(doc.querySelector('title')?.text ?? '')} containsNeedle=${html.contains(_needle)}');
      _needleContext(out, html);
      final main = doc.querySelector('main') ?? doc.querySelector('#content') ?? doc.body!;
      out.writeln('```');
      out.writeln(_collapse(main.text).characters300);
      out.writeln('```');
      var n = 0;
      for (final a in main.querySelectorAll('a')) {
        final href = a.attributes['href'] ?? '';
        if (!href.endsWith('.pdf') && !href.endsWith('.html')) continue;
        out.writeln('  link: ${_collapse(a.text)} <$href>');
        if (++n >= 60) break;
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
