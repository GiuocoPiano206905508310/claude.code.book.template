// GitHub Actions上で1日1回実行され、MHLW・日本年金機構の記事一覧を取得して
// JSON（sharoushi-news-feed/articles.json、GitHub Pages経由でアプリから
// 読み込まれる）として書き出す本番用スクリプト。RSSは使わず、Phase 4と
// 同じ通常のHTTP GET+HTMLパースのみを行う
// （.github/workflows/sharoushi-news-daily-feed.yml から呼び出される）。
//
// 取得したタイトルのうち、前回のフィードにまだ無い（＝本当に新着の）記事
// だけを対象に、概要・実務影響・重要ポイント・対象を次の優先順位で用意する:
//   1. ANTHROPIC_API_KEY が設定されていれば、Claude Haiku 4.5で生成
//      （記事本文までは取得していないため、タイトルと一般的な制度知識
//      からの推測になる）。
//   2. 上記が無い、または失敗した場合は、記事の個別ページ本文を取得し、
//      meta descriptionまたは冒頭の段落を概要欄にそのまま使う（AIは
//      使わず、単純なHTML解析のみ）。
//   3. それも取得できない場合は、汎用の案内文にフォールバックする。
// いずれの場合もジョブ全体は失敗させない。既に前回のフィードに含まれる
// 記事は内容をそのまま引き継ぎ、無駄なリクエスト・API呼び出しをしない。
//
// 使い方: dart run tool/fetch_daily_feed.dart [出力先パス]
//   （省略時は ../sharoushi-news-feed/articles.json）
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/models/article_candidate.dart';
import 'package:sharoushi_news/services/ai/ai_summary_service.dart';
import 'package:sharoushi_news/services/feed/article_excerpt_service.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';
import 'package:sharoushi_news/services/parser/nenkin_parser.dart';

const _maxTotalArticles = 40;
const _genericSummary = 'この記事はタイトルのみ自動取得されています。詳細は「公式サイトで原文を見る」からご確認ください。';
const _genericPracticalImpact = '実務への影響は原文をご確認ください。';
const _genericTarget = '原文をご確認ください。';

class _Candidate {
  _Candidate(this.candidate, this.target);
  final ArticleCandidate candidate;
  final ListingTarget target;
}

Future<void> main(List<String> args) async {
  final outputPath = args.isNotEmpty
      ? args[0]
      : '../sharoushi-news-feed/articles.json';

  final previousById = _readPreviousEntries(outputPath);

  final candidates = <_Candidate>[];
  final seenUrls = <String>{};

  await _fetchAll(
    fetcher: NewsFetcher(parser: MhlwParser()),
    targets: mhlwListingTargets,
    out: candidates,
    seenUrls: seenUrls,
  );
  await _fetchAll(
    fetcher: NewsFetcher(parser: NenkinParser()),
    targets: nenkinListingTargets,
    out: candidates,
    seenUrls: seenUrls,
  );

  candidates.sort(
    (a, b) => (b.candidate.publishedAt ?? DateTime(0)).compareTo(
      a.candidate.publishedAt ?? DateTime(0),
    ),
  );
  final trimmed = candidates.take(_maxTotalArticles).toList();

  final apiKey = Platform.environment['ANTHROPIC_API_KEY'];
  final aiService = (apiKey == null || apiKey.isEmpty)
      ? null
      : AiSummaryService(apiKey: apiKey);
  if (aiService == null) {
    stderr.writeln('ANTHROPIC_API_KEY が未設定のため、新規記事はAI要約なしの汎用文になります。');
  }

  final excerptService = ArticleExcerptService();

  final entries = <Map<String, Object?>>[];
  for (var i = 0; i < trimmed.length; i++) {
    final item = trimmed[i];
    final existing = previousById[item.candidate.url];
    if (existing != null && existing['title'] == item.candidate.title) {
      entries.add(existing);
      continue;
    }
    final result = await _buildEntry(item, aiService, excerptService);
    entries.add(result.entry);
    if (result.calledAi) {
      await Future.delayed(const Duration(milliseconds: 500));
    } else if (result.fetchedExcerpt) {
      await Future.delayed(const Duration(seconds: 2));
    }
  }

  final json = const JsonEncoder.withIndent('  ').convert(entries);
  final file = File(outputPath);
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(json);
  stderr.writeln('Wrote ${entries.length} articles to ${file.path}');
}

Map<String, Map<String, Object?>> _readPreviousEntries(String path) {
  final file = File(path);
  if (!file.existsSync()) return {};
  try {
    final decoded = jsonDecode(file.readAsStringSync()) as List;
    return {
      for (final e in decoded.cast<Map<String, dynamic>>())
        e['id'] as String: e,
    };
  } catch (e) {
    stderr.writeln('既存フィードの読み込みに失敗したため、全件を再生成します: $e');
    return {};
  }
}

Future<void> _fetchAll({
  required NewsFetcher fetcher,
  required List<ListingTarget> targets,
  required List<_Candidate> out,
  required Set<String> seenUrls,
}) async {
  for (var i = 0; i < targets.length; i++) {
    final target = targets[i];
    stderr.writeln('Fetching ${target.url} ...');
    try {
      final candidates = await fetcher.fetchListing(target.url);
      for (final c in candidates) {
        if (!seenUrls.add(c.url)) continue;
        out.add(_Candidate(c, target));
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

class _BuildResult {
  _BuildResult(
    this.entry, {
    required this.calledAi,
    required this.fetchedExcerpt,
  });
  final Map<String, Object?> entry;
  final bool calledAi;
  final bool fetchedExcerpt;
}

Future<_BuildResult> _buildEntry(
  _Candidate item,
  AiSummaryService? aiService,
  ArticleExcerptService excerptService,
) async {
  final c = item.candidate;
  final target = item.target;
  final now = DateTime.now();
  final publishedAt = c.publishedAt ?? now;

  var summary = _genericSummary;
  var practicalImpact = _genericPracticalImpact;
  var importantPoints = <String>[];
  var targetLabel = _genericTarget;
  var isAiGenerated = false;
  var calledAi = false;
  var fetchedExcerpt = false;

  if (aiService != null) {
    calledAi = true;
    try {
      final ai = await aiService.summarize(
        title: c.title,
        sourceName: target.source.name,
        categoryLabel: target.defaultCategory.label,
      );
      summary = ai.summary;
      practicalImpact = ai.practicalImpact;
      importantPoints = ai.importantPoints;
      targetLabel = ai.target;
      isAiGenerated = true;
    } catch (e) {
      stderr.writeln('AI要約生成に失敗しました（${c.url}）: $e');
    }
  }

  if (!isAiGenerated) {
    fetchedExcerpt = true;
    try {
      final excerpt = await excerptService.fetchExcerpt(c.url);
      if (excerpt != null && excerpt.isNotEmpty) {
        summary = excerpt;
      }
    } catch (e) {
      stderr.writeln('本文抜粋の取得に失敗したため汎用文を使用します（${c.url}）: $e');
    }
  }

  final entry = {
    'id': c.url,
    'title': c.title,
    'sourceName': target.source.name,
    'sourceUrl': target.source.baseUrl,
    'canonicalUrl': c.url,
    'publishedAt': publishedAt.toIso8601String(),
    'fetchedAt': now.toIso8601String(),
    'category': target.defaultCategory.name,
    'summary': summary,
    'practicalImpact': practicalImpact,
    'importantPoints': importantPoints,
    'target': targetLabel,
    'importance': 1,
    'isAiGenerated': isAiGenerated,
  };
  return _BuildResult(
    entry,
    calledAi: calledAi,
    fetchedExcerpt: fetchedExcerpt,
  );
}
