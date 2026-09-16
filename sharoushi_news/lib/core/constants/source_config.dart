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
