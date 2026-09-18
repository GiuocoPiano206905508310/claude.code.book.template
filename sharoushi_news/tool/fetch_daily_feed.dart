// GitHub Actions上で1日1回実行され、MHLW・日本年金機構の記事一覧を取得して
// JSON（sharoushi-news-feed/articles.json、GitHub Pages経由でアプリから
// 読み込まれる）として書き出す本番用スクリプト。RSSは使わず、Phase 4と
// 同じ通常のHTTP GET+HTMLパースのみを行う
// （.github/workflows/sharoushi-news-daily-feed.yml から呼び出される）。
//
// 一覧取得時に、審議会開催案内・記者会見概要等の「参考程度」の会議告知
// タイトルは除外する（_isLowValueTitle）。また、pinnedArticles
// （source_config.dart）で指定した実務上重要な個別ページ・PDFは、一覧
// 巡回の結果に関わらず常にフィードへ含める。
//
// 取得したタイトルのうち、前回のフィードにまだ無い（＝本当に新着の）記事
// だけを対象に、概要・実務影響・重要ポイント・対象・カテゴリーを次の
// 優先順位で用意する:
//   1. pinnedArticlesで内容を人手で確認済み（summary等を指定）の場合は
//      それをそのまま採用する（AI・本文抜粋は使わない）。
//   2. ANTHROPIC_API_KEY が設定されていれば、記事の個別ページ本文抜粋を
//      取得したうえでClaude Haiku 4.5に渡し、本文にもとづいた詳しく
//      正確な内容とカテゴリー分類を生成する（本文が取得できない場合は
//      タイトルと一般的な制度知識からの推測にとどめる）。
//   3. 上記が無い、または失敗した場合は、記事の個別ページ本文を取得し、
//      meta descriptionまたは冒頭の段落を概要欄にそのまま使う（AIは
//      使わず、単純なHTML解析のみ）。
//   4. それも取得できない場合は、汎用の案内文にフォールバックする。
// いずれの場合もジョブ全体は失敗させない。既に前回のフィードに含まれる
// 記事は内容をそのまま引き継ぎ、無駄なリクエスト・API呼び出しをしない。
//
// 使い方: dart run tool/fetch_daily_feed.dart [出力先パス]
//   （省略時は ../sharoushi-news-feed/articles.json）
import 'dart:convert';
import 'dart:io';

import 'package:sharoushi_news/core/constants/source_config.dart';
import 'package:sharoushi_news/core/utils/text_sanitizer.dart';
import 'package:sharoushi_news/models/article_candidate.dart';
import 'package:sharoushi_news/models/article.dart';
import 'package:sharoushi_news/services/ai/ai_summary_service.dart';
import 'package:sharoushi_news/services/feed/article_excerpt_service.dart';
import 'package:sharoushi_news/services/news/news_fetcher.dart';
import 'package:sharoushi_news/services/parser/mhlw_parser.dart';
import 'package:sharoushi_news/services/parser/nenkin_parser.dart';

const _maxTotalArticles = 40;
const _genericSummary = 'この記事はタイトルのみ自動取得されています。詳細は「公式サイトで原文を見る」からご確認ください。';
const _genericPracticalImpact = '実務への影響は原文をご確認ください。';
const _genericTarget = '原文をご確認ください。';

// カテゴリー判定・要約生成のロジックを変更するたびに値を上げる。
// 過去に生成された記事（このフィールドが無い、または値が古いもの）は、
// タイトルが変わっていなくてもキャッシュを使わず再生成の対象とする。
// これにより、一覧ページURL単位の粗い分類しかできなかった過去の記事も、
// ロジック更新後は次回実行時に新しい判定へ自動的に置き換わる。
const _schemaVersion = 3;

class _Candidate {
  _Candidate(this.candidate, this.target, {this.pinned});
  final ArticleCandidate candidate;
  final ListingTarget target;

  /// 由来がpinnedArticlesの場合の元データ。nullでなければ、
  /// カテゴリーはAI・PDF判定より常にpinned側の指定を優先する。
  final PinnedArticle? pinned;

  bool get isPinned => pinned != null;
}

NewsCategory? _parseCategory(String? name) {
  if (name == null) return null;
  for (final c in NewsCategory.values) {
    if (c.name == name) return c;
  }
  return null;
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

  // pinnedArticles（実務上重要な固定ページ）は日付が無い、または一覧の
  // 新着順から外れがちなため、直近40件の足切りとは無関係に必ず含める。
  // 同一URLが通常の巡回でも見つかった場合はpinned側の情報を優先する。
  final byUrl = <String, _Candidate>{
    for (final c in candidates.take(_maxTotalArticles)) c.candidate.url: c,
  };
  for (final p in pinnedArticles) {
    byUrl[p.url] = _Candidate(
      ArticleCandidate(title: p.title, url: p.url, publishedAt: DateTime.now()),
      ListingTarget(source: p.source, url: p.url, defaultCategory: p.category),
      pinned: p,
    );
  }
  final trimmed = byUrl.values.toList();

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
    final canReuse =
        existing != null &&
        existing['title'] == item.candidate.title &&
        (existing['schemaVersion'] as int? ?? 1) >= _schemaVersion &&
        !_isPlaceholderSummary(existing['summary'] as String?);
    if (canReuse) {
      entries.add(existing);
      continue;
    }
    final result = await _buildEntry(item, aiService, excerptService);
    entries.add(result.entry);
    if (result.fetchedBody) {
      await Future.delayed(const Duration(milliseconds: 1500));
    }
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

/// 前回の概要が「まだ本物の内容を得られていない」状態（汎用の案内文、
/// またはサイト共通の定型文）かどうかを判定する。該当する場合は、
/// タイトルが変わっていなくても再取得の対象とする
/// （記事自体は同じでも、以前は本文取得やAI要約に失敗していた可能性が
/// あるため）。
bool _isPlaceholderSummary(String? summary) {
  if (summary == null || summary == _genericSummary) return true;
  return ArticleExcerptService.isLowQualityExcerpt(summary);
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

// 実データ確認の結果、新着一覧の大半が審議会・記者会見等の開催案内で
// 占められており、社労士実務に直結しない「参考程度」の記事ばかりに
// なっていた。これらは会議の存在を知らせるだけで内容の実質を伴わない
// ため、フィードから除外し、実務に関わる記事の割合を上げる。
final _lowValueTitlePattern = RegExp(
  r'審議会|分科会|部会|専門委員会|検討会|ワーキング・グループ|連絡協議会|作業班'
  r'|記者会見|大臣会見|議事録|議事要旨|傍聴'
  r'|開催(案内|について|します)$',
);

bool _isLowValueTitle(String title) => _lowValueTitlePattern.hasMatch(title);

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
      var kept = 0;
      for (final c in candidates) {
        if (!seenUrls.add(c.url)) continue;
        if (_isLowValueTitle(c.title)) continue;
        out.add(_Candidate(c, target));
        kept++;
      }
      stderr.writeln('  -> ${candidates.length} candidates ($kept kept)');
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
    required this.fetchedBody,
  });
  final Map<String, Object?> entry;
  final bool calledAi;
  final bool fetchedExcerpt;
  final bool fetchedBody;
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
  final pinned = item.pinned;

  // pinnedArticlesで内容を人手で書いた場合はAI・本文抜粋を一切使わず、
  // その内容をそのまま採用する（カテゴリーも常にpinned側の指定を優先）。
  if (pinned != null && pinned.hasCuratedContent) {
    final entry = {
      'id': c.url,
      'title': sanitizeScrapedText(pinned.title),
      'sourceName': target.source.name,
      'sourceUrl': target.source.baseUrl,
      'canonicalUrl': c.url,
      'publishedAt': publishedAt.toIso8601String(),
      'fetchedAt': now.toIso8601String(),
      'category': pinned.category.name,
      'summary': sanitizeScrapedText(pinned.summary!),
      'practicalImpact': sanitizeScrapedText(
        pinned.practicalImpact ?? _genericPracticalImpact,
      ),
      'importantPoints': sanitizeScrapedTextList(
        pinned.importantPoints ?? const [],
      ),
      'target': sanitizeScrapedText(pinned.target ?? _genericTarget),
      'importance': 2,
      'isAiGenerated': false,
      'schemaVersion': _schemaVersion,
    };
    return _BuildResult(entry, calledAi: false, fetchedExcerpt: false, fetchedBody: false);
  }

  // PDFはパンフレット・報告書等であることが多いため、一覧ページ側の
  // defaultCategoryに関わらずパンフレットに分類する。ただし人手で
  // 指定したpinnedArticlesのカテゴリーは常にこの判定より優先する。
  final isPdf = c.url.toLowerCase().endsWith('.pdf');
  var category = item.isPinned
      ? target.defaultCategory
      : (isPdf ? NewsCategory.pamphlet : target.defaultCategory);

  var summary = _genericSummary;
  var practicalImpact = _genericPracticalImpact;
  var importantPoints = <String>[];
  var targetLabel = _genericTarget;
  var isAiGenerated = false;
  var calledAi = false;
  var fetchedExcerpt = false;
  var fetchedBody = false;

  if (aiService != null) {
    calledAi = true;
    // AIには本文抜粋を渡せる場合は渡し、タイトルだけの推測ではなく
    // 実際の内容にもとづいた詳しく正確な要約を生成できるようにする。
    String? bodyText;
    try {
      bodyText = await excerptService.fetchBodyText(c.url);
      fetchedBody = true;
    } catch (e) {
      stderr.writeln('本文取得に失敗しました（AI要約はタイトルのみで生成します）（${c.url}）: $e');
    }
    try {
      final ai = await aiService.summarize(
        title: c.title,
        sourceName: target.source.name,
        categoryLabel: category.label,
        bodyText: bodyText,
      );
      summary = ai.summary;
      practicalImpact = ai.practicalImpact;
      importantPoints = ai.importantPoints;
      targetLabel = ai.target;
      isAiGenerated = true;
      // 一覧ページのURL単位の分類は粗いため、PDF・pinnedでない限りは
      // AIが本文（または一般知識）にもとづいて判定したカテゴリーを優先する。
      if (!item.isPinned && !isPdf) {
        category = _parseCategory(ai.category) ?? category;
      }
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
    'title': sanitizeScrapedText(c.title),
    'sourceName': target.source.name,
    'sourceUrl': target.source.baseUrl,
    'canonicalUrl': c.url,
    'publishedAt': publishedAt.toIso8601String(),
    'fetchedAt': now.toIso8601String(),
    'category': category.name,
    'summary': sanitizeScrapedText(summary),
    'practicalImpact': sanitizeScrapedText(practicalImpact),
    'importantPoints': sanitizeScrapedTextList(importantPoints),
    'target': sanitizeScrapedText(targetLabel),
    'importance': 1,
    'isAiGenerated': isAiGenerated,
    'schemaVersion': _schemaVersion,
  };
  return _BuildResult(
    entry,
    calledAi: calledAi,
    fetchedExcerpt: fetchedExcerpt,
    fetchedBody: fetchedBody,
  );
}
