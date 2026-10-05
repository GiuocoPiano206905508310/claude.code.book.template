import '../parser/watched_page_parser.dart';

/// 監視対象ページで新しく増えたリンク（＝新着の資料・ページ）。
class DiscoveredLink {
  const DiscoveredLink({
    required this.url,
    required this.title,
    required this.page,
    required this.publishedAt,
    required this.datedOnPage,
  });

  factory DiscoveredLink.fromJson(Map<String, dynamic> json) => DiscoveredLink(
    url: json['url'] as String,
    title: json['title'] as String,
    page: json['page'] as String,
    publishedAt: DateTime.parse(json['publishedAt'] as String),
    datedOnPage: json['datedOnPage'] as bool? ?? false,
  );

  final String url;
  final String title;

  /// リンクが載っていた監視対象ページ。
  final String page;

  /// ページ上の掲載日等。無い場合はリンクを初めて検出した日（日本時間）。
  /// フィードは1日5回生成するため、検出日は公式サイトへの掲載日とほぼ一致する。
  final DateTime publishedAt;

  /// [publishedAt]がページ上の日付表記によるものならtrue、検出日ならfalse。
  final bool datedOnPage;

  Map<String, Object?> toJson() => {
    'url': url,
    'title': title,
    'page': page,
    'publishedAt': publishedAt.toIso8601String(),
    'datedOnPage': datedOnPage,
  };
}

/// 監視対象ページのリンクを前回の実行時と比べ、新しく増えたリンクを記録する。
///
/// 状態（ページごとの既知のリンク、検出済みの記事）はJSONとしてフィードと
/// 同じ場所に保存し、次回の実行で読み込む。
class WatchedPageTracker {
  WatchedPageTracker.fromJson(Map<String, dynamic>? json, {required this.today}) {
    final pages = json?['pages'] as Map<String, dynamic>? ?? const {};
    for (final entry in pages.entries) {
      _known[entry.key] = (entry.value as List).cast<String>().toSet();
    }
    for (final d in json?['discovered'] as List? ?? const []) {
      _discovered.add(DiscoveredLink.fromJson(d as Map<String, dynamic>));
    }
  }

  /// 1回の実行で1ページにこれより多くのリンクが増えた場合は、ページの
  /// 改装・構成変更とみなして記事にせず、既知のリンクとして登録し直す
  /// （既存の資料が一度に大量の「新着」として並ぶのを防ぐ）。
  static const maxNewLinksPerPage = 15;

  /// 検出した記事をフィードに残す期間。
  static const window = Duration(days: 180);

  /// 日本時間の今日。リンクの検出日として使う。
  final DateTime today;
  final _known = <String, Set<String>>{};
  final _discovered = <DiscoveredLink>[];

  /// [page]から取得した[links]を記録し、今回新しく見つかったリンクを返す。
  ///
  /// 初めて監視するページは、既存のリンクをすべて既知として登録するだけで
  /// 記事にはしない（監視を始める前からある資料は新着ではないため）。
  List<DiscoveredLink> record(String page, List<WatchedLink> links) {
    if (links.isEmpty) return const [];
    final known = _known[page];
    if (known == null) {
      _known[page] = {for (final l in links) l.url};
      return const [];
    }
    final fresh = [
      for (final l in links)
        if (known.add(l.url)) l,
    ];
    if (fresh.length > maxNewLinksPerPage) return const [];

    final found = [
      for (final l in fresh)
        DiscoveredLink(
          url: l.url,
          title: l.title,
          page: page,
          publishedAt: l.date ?? today,
          datedOnPage: l.date != null,
        ),
    ];
    _discovered.addAll(found);
    return found;
  }

  /// フィードに載せる検出済みの記事（[window]以内のもの）。
  List<DiscoveredLink> get recent {
    final cutoff = today.subtract(window);
    return [
      for (final d in _discovered)
        if (!d.publishedAt.isBefore(cutoff)) d,
    ];
  }

  Map<String, Object?> toJson() => {
    'pages': {
      for (final e in _known.entries) e.key: (e.value.toList()..sort()),
    },
    'discovered': [for (final d in recent) d.toJson()],
  };
}
