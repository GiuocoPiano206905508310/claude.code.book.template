import '../../models/article.dart';

/// 取得元サイト1件分の設定（仕様: SourceConfig(id, name, baseUrl)）。
class SourceConfig {
  const SourceConfig({
    required this.id,
    required this.name,
    required this.baseUrl,
  });

  final String id;
  final String name;
  final String baseUrl;
}

/// 一覧ページ1件分の取得対象。同じサイトでも分野別に複数のURLを持つ場合、
/// URLごとに対応するカテゴリーを固定しておくことで、AI要約（Phase 9〜）が
/// 実装されるまでの間も、ある程度意味のあるカテゴリー分類ができるようにする。
class ListingTarget {
  const ListingTarget({
    required this.source,
    required this.url,
    required this.defaultCategory,
  });

  final SourceConfig source;
  final String url;
  final NewsCategory defaultCategory;
}

const mhlwSource = SourceConfig(
  id: 'mhlw',
  name: '厚生労働省',
  baseUrl: 'https://www.mhlw.go.jp',
);

/// ユーザーから提供された、実際にアクセス可能な一覧ページ。
/// 「新着情報」はジャンル横断のため、暫定的に法改正カテゴリーへ寄せている
/// （個別記事のカテゴリー分類はPhase 9のAI要約実装時に精緻化する想定）。
final List<ListingTarget> mhlwListingTargets = [
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/new-info/',
    defaultCategory: NewsCategory.lawChange,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/new-info/shingi.html',
    defaultCategory: NewsCategory.lawChange,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150876_156.html',
    defaultCategory: NewsCategory.employmentInsurance,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150858_161_162.html',
    defaultCategory: NewsCategory.labor,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150860_166.html',
    defaultCategory: NewsCategory.labor,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150863_168_169.html',
    defaultCategory: NewsCategory.labor,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150865_1153_169.html',
    defaultCategory: NewsCategory.labor,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_150867_1154_170.html',
    defaultCategory: NewsCategory.pension,
  ),
];

const nenkinSource = SourceConfig(
  id: 'nenkin',
  name: '日本年金機構',
  baseUrl: 'https://www.nenkin.go.jp',
);

/// ユーザーから提供された実在URL（https://www.nenkin.go.jp/oshirase/taisetu/
/// kojin/2026/202604/0401.html）から、個人向け（kojin）・事業所向け
/// （jigyosho）それぞれの年別インデックスページという構造を推測している。
/// jigyosho/2026/index.html はユーザーから提供された実URL。kojin側は同じ
/// 命名規則からの推測のため、存在しない場合は取得時にエラーとして扱われる
/// （NewsFetcher／診断スクリプト側でハンドリング済み）。
final List<ListingTarget> nenkinListingTargets = [
  const ListingTarget(
    source: nenkinSource,
    url: 'https://www.nenkin.go.jp/oshirase/taisetu/jigyosho/2026/index.html',
    defaultCategory: NewsCategory.socialInsurance,
  ),
  const ListingTarget(
    source: nenkinSource,
    url: 'https://www.nenkin.go.jp/oshirase/taisetu/kojin/2026/index.html',
    defaultCategory: NewsCategory.pension,
  ),
];

/// 一覧ページの巡回だけでは拾えない、実務上重要な個別ページ・PDFを
/// 常に取得対象に含めるための固定リスト（ユーザー指定）。新着一覧に
/// 載らない制度解説ページや調査報告書など、実務に直結する内容を
/// 「参考程度」の会議開催案内等に埋もれさせないために用いる。
class PinnedArticle {
  const PinnedArticle({
    required this.title,
    required this.url,
    required this.source,
    required this.category,
  });

  final String title;
  final String url;
  final SourceConfig source;
  final NewsCategory category;
}

const pinnedArticles = [
  PinnedArticle(
    title: '保険料調整制度（随時改定の特例）について',
    url: 'https://www.nenkin.go.jp/tokusetsu/hokenryochosei.html',
    source: nenkinSource,
    category: NewsCategory.socialInsurance,
  ),
  PinnedArticle(
    title: 'いわゆる社会保険料削減ビジネスを行っていると疑われる事業所に対する事業所調査の状況について（報告）',
    url: 'https://www.mhlw.go.jp/content/12508000/001749239.pdf',
    source: mhlwSource,
    category: NewsCategory.pamphlet,
  ),
];
