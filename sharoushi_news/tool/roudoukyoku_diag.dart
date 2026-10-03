// 一時的な診断用スクリプト（都道府県労働局サイトのHTML構造の確認用）。
// サンドボックスからjsite.mhlw.go.jpに接続できないため、GitHub Actions上で
// 実行し、結果をリポジトリにコミットして確認する。確認後に削除する。
import 'dart:convert';
import 'dart:io';

import 'package:html/dom.dart';
import 'package:html/parser.dart' as html_parser;
import 'package:http/http.dart' as http;

const _base = 'https://jsite.mhlw.go.jp';
const _slugs = [
  'hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima',
  'ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa',
  'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu',
  'shizuoka', 'aichi', 'mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara',
  'wakayama', 'tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi',
  'tokushima', 'kagawa', 'ehime', 'kochi', 'fukuoka', 'saga', 'nagasaki',
  'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa',
];

// 詳細に見るページ（上限なしでリンクを出す）。
const _detailUrls = [
  '$_base/hokkaido-roudoukyoku/',
  '$_base/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin/h30career-up.html',
  '$_base/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin.html',
  '$_base/hokkaido-roudoukyoku/hourei_seido_tetsuzuki/joseikin/index.html',
  '$_base/tokyo-roudoukyoku/',
  '$_base/tokyo-roudoukyoku/hourei_seido_tetsuzuki/joseikin.html',
  '$_base/tokyo-roudoukyoku/hourei_seido_tetsuzuki/joseikin/index.html',
];

final _client = http.Client();
final _out = StringBuffer();

String _collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();
String _cut(String s, int n) => s.length > n ? '${s.substring(0, n)}…' : s;

Future<void> _dump(String url, {required int maxLinks, required bool sample}) async {
  _out.writeln('\n## $url');
  http.Response res;
  try {
    res = await _client
        .get(Uri.parse(url), headers: const {'User-Agent': 'SharoushiNewsApp-Prototype/0.1'})
        .timeout(const Duration(seconds: 20));
  } catch (e) {
    _out.writeln('FETCH ERROR: $e');
    return;
  }
  final raw = latin1.decode(res.bodyBytes, allowInvalid: true);
  final metaCharset = RegExp(r'charset=["\x27]?([\w\-]+)', caseSensitive: false)
      .firstMatch(raw)
      ?.group(1);
  _out.writeln(
    'status=${res.statusCode} content-type=${res.headers['content-type']} '
    'meta-charset=$metaCharset bytes=${res.bodyBytes.length} '
    'finalUrl=${res.request?.url}',
  );
  if (res.statusCode != 200) return;

  final html = utf8.decode(res.bodyBytes, allowMalformed: true);
  final doc = html_parser.parse(html);
  if (sample) {
    _out.writeln('TEXT SAMPLE: ${_cut(_collapse(doc.body?.text ?? ''), 2500)}');
  }
  final anchors = doc.querySelectorAll('a');
  _out.writeln('anchors=${anchors.length}');
  var shown = 0;
  for (final a in anchors) {
    final text = _collapse(a.text);
    final href = a.attributes['href'] ?? '';
    if (text.isEmpty || href.isEmpty || href.startsWith('#')) continue;
    final parent = a.parent;
    final ctx = parent == null ? '' : _collapse(parent.text);
    final grand = parent?.parent;
    final tags = [
      if (grand != null) _tag(grand),
      if (parent != null) _tag(parent),
    ].join(' > ');
    _out.writeln('- [${_cut(text, 90)}]($href) {$tags} ctx="${_cut(ctx, 160)}"');
    if (++shown >= maxLinks) break;
  }
}

String _tag(Element e) {
  final cls = e.attributes['class'];
  return cls == null || cls.isEmpty ? e.localName ?? '?' : '${e.localName}.${cls.replaceAll(' ', '.')}';
}

Future<void> main() async {
  for (final url in _detailUrls) {
    await _dump(url, maxLinks: 400, sample: true);
    await Future.delayed(const Duration(seconds: 2));
  }
  for (final slug in _slugs) {
    await _dump('$_base/$slug-roudoukyoku/', maxLinks: 120, sample: false);
    await Future.delayed(const Duration(seconds: 2));
  }
  final file = File('diag/roudoukyoku.md');
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(_out.toString());
  stderr.writeln('wrote ${file.path} (${_out.length} chars)');
}
