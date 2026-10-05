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
    this.lockCategory = false,
    this.ministryWide = false,
  });

  final SourceConfig source;
  final String url;
  final NewsCategory defaultCategory;

  /// trueの場合、AIやPDF判定でカテゴリーを変えず[defaultCategory]に固定する。
  final bool lockCategory;

  /// 医療・医薬品・福祉等を含む省全体の新着一覧の場合true。タイトルが
  /// 社労士実務の分野の語（isPracticeRelatedTitle）を含む記事だけを取り込む。
  final bool ministryWide;
}

const mhlwSource = SourceConfig(
  id: 'mhlw',
  name: '厚生労働省',
  baseUrl: 'https://www.mhlw.go.jp',
);

/// ユーザーから提供された、実際にアクセス可能な一覧ページ。
/// 「新着情報」は省全体の一覧のため[ListingTarget.ministryWide]とし、
/// 社労士実務の分野の記事だけを取り込む（カテゴリーはAIが判定する）。
final List<ListingTarget> mhlwListingTargets = [
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/new-info/',
    defaultCategory: NewsCategory.lawChange,
    ministryWide: true,
  ),
  const ListingTarget(
    source: mhlwSource,
    url: 'https://www.mhlw.go.jp/stf/new-info/shingi.html',
    defaultCategory: NewsCategory.lawChange,
    ministryWide: true,
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

/// 新しい資料が追加されても新着一覧には載らないことがある、厚生労働省の
/// 制度別ページ。日次フィード生成時に前回からのリンクの増加を調べ、増えた
/// リンクを記事として取り込む（WatchedPageTracker）。実例として「『シフト制』
/// で働く場合の年次有給休暇について」のリーフレットは、新着一覧に載らず
/// 「いわゆる『シフト制』について」のページにリンクが追加されただけだった。
/// いずれもGitHub Actions上で実際に取得できることを確認済み。
const watchedPages = [
  'https://www.mhlw.go.jp/stf/newpage_22954.html', // シフト制
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000056460.html', // 労働基準関係リーフレット
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/index.html', // 労働基準
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/roukikaitei/index.html', // 労働基準法改正
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/index.html', // 事業主の方へ（労働基準）
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/anzen/index.html', // 安全・衛生
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/minimumichiran/index.html', // 最低賃金
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyoukintou/index.html', // 雇用環境・均等
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyoukintou/seisaku06/index.html', // ハラスメント
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyoukintou/ryouritsu/index.html', // 仕事と介護の両立
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000130583.html', // 育児・介護休業法
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html', // 女性活躍推進法
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000144972.html', // 同一労働同一賃金
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/index.html', // 有期・パート・派遣
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/haken-shoukai/index.html', // 派遣・職業紹介
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/koureisha/index.html', // 高年齢者雇用
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/shougaishakoyou/index.html', // 障害者雇用
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/index.html', // 雇用関係助成金
  'https://www.mhlw.go.jp/tekiyoukakudai/', // 社会保険適用拡大
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/index.html', // 年金
];

const nenkinSource = SourceConfig(
  id: 'nenkin',
  name: '日本年金機構',
  baseUrl: 'https://www.nenkin.go.jp',
);

const govOnlineSource = SourceConfig(
  id: 'gov-online',
  name: '政府広報オンライン',
  baseUrl: 'https://www.gov-online.go.jp',
);

const cfaSource = SourceConfig(
  id: 'cfa',
  name: 'こども家庭庁',
  baseUrl: 'https://www.cfa.go.jp',
);

const kyoukaikenpoSource = SourceConfig(
  id: 'kyoukaikenpo',
  name: '全国健康保険協会（協会けんぽ）',
  baseUrl: 'https://www.kyoukaikenpo.or.jp',
);

const ntaSource = SourceConfig(
  id: 'nta',
  name: '国税庁',
  baseUrl: 'https://www.nta.go.jp',
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

/// 都道府県労働局（jsite.mhlw.go.jp）。助成金の取扱い変更・様式公表などは
/// 各労働局が独自に告知することがあるため、トップページの新着一覧と
/// 助成金ページの新着情報を巡回し、助成金関連の記事だけを取り込む
/// （絞り込みは tool/fetch_daily_feed.dart 側で行う）。
///
/// 助成金ページのURLは局ごとに異なるため、GitHub Actions上で各局トップ
/// ページのメニューから「各種助成金制度」等のリンク先を確認して設定した。
/// 福岡は確認できなかったためトップページのみ。
const _roudoukyoku = <(String, String, String?)>[
  ('hokkaido', '北海道', 'hourei_seido_tetsuzuki/joseikin.html'),
  ('aomori', '青森', 'newpage_00310.html'),
  ('iwate', '岩手', 'hourei_seido_tetsuzuki/joseikin.html'),
  ('miyagi', '宮城', '1/180/181.html'),
  ('akita', '秋田', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('yamagata', '山形', 'newpage_00437.html'),
  ('fukushima', '福島', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('ibaraki', '茨城', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('tochigi', '栃木', 'hourei_seido_tetsuzuki/_79457.html'),
  ('gunma', '群馬', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('saitama', '埼玉', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('chiba', '千葉', 'riyousha_mokuteki_menu/jigyounushi/jigyounushi_jouhou/_120069.html'),
  ('tokyo', '東京', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('kanagawa', '神奈川', 'home/_20190509_00001.html'),
  ('niigata', '新潟', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('toyama', '富山', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('ishikawa', '石川', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('fukui', '福井', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('yamanashi', '山梨', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('nagano', '長野', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('gifu', '岐阜', 'riyousha_mokuteki_menu/mokuteki_naiyou/joseikin.html'),
  ('shizuoka', '静岡', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('aichi', '愛知', 'hourei_seido_tetsuzuki/_121796.html'),
  ('mie', '三重', 'riyousha_mokuteki_menu/joseikin_seido.html'),
  ('shiga', '滋賀', 'news_topics/hr_osirase/jyoseikin_001.html'),
  ('kyoto', '京都', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('osaka', '大阪', 'mokuteki_naiyou/jyosei.html'),
  ('hyogo', '兵庫', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('nara', '奈良', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('wakayama', '和歌山', 'hourei_seido_tetsuzuki/kakushu_joseikin/hourei_seido.html'),
  ('tottori', '鳥取', 'hourei_seido_tetsuzuki/joseikin.html'),
  ('shimane', '島根', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('okayama', '岡山', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('hiroshima', '広島', 'hourei_seido_tetsuzuki/kakusyujoseikinseido.html'),
  ('yamaguchi', '山口', 'kigyou/joseikin_1.html'),
  ('tokushima', '徳島', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('kagawa', '香川', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('ehime', '愛媛', 'hourei_seido_tetsuzuki/kakushu_joseikin/jigyounusi_2021.html'),
  ('kochi', '高知', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('fukuoka', '福岡', null),
  ('saga', '佐賀', 'newpage_00166.html'),
  ('nagasaki', '長崎', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('kumamoto', '熊本', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('oita', '大分', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
  ('miyazaki', '宮崎', 'riyousha_mokuteki_menu/mokuteki_naiyou/_119916.html'),
  ('kagoshima', '鹿児島', 'hourei_seido_tetsuzuki/jyoseikin.html'),
  ('okinawa', '沖縄', 'hourei_seido_tetsuzuki/kakushu_joseikin.html'),
];

final List<ListingTarget> roudoukyokuListingTargets = [
  for (final (slug, name, subsidyPath) in _roudoukyoku) ...() {
    final base = 'https://jsite.mhlw.go.jp/$slug-roudoukyoku/';
    final source = SourceConfig(id: 'roudoukyoku-$slug', name: '$name労働局', baseUrl: base);
    return [
      ListingTarget(
        source: source,
        url: base,
        defaultCategory: NewsCategory.subsidy,
        lockCategory: true,
      ),
      if (subsidyPath != null)
        ListingTarget(
          source: source,
          url: '$base$subsidyPath',
          defaultCategory: NewsCategory.subsidy,
          lockCategory: true,
        ),
    ];
  }(),
];

/// 一覧ページの巡回だけでは拾えない、実務上重要な個別ページ・PDFを
/// 常に取得対象に含めるための固定リスト（ユーザー指定）。新着一覧に
/// 載らない制度解説ページや調査報告書など、実務に直結する内容を
/// 「参考程度」の会議開催案内等に埋もれさせないために用いる。
///
/// [summary]以下を指定した場合、その内容は人手で確認済みの正確な情報
/// として扱われ、AI要約・本文抜粋は行わずそのまま採用する
/// （[category]も一覧ページ側の推定やAIによる自動分類の対象にせず、
/// ここで指定した値をそのまま使う）。省略した場合は他の取得記事と
/// 同様にAI要約→本文抜粋の順にフォールバックする。
class PinnedArticle {
  const PinnedArticle({
    required this.title,
    required this.url,
    required this.source,
    required this.category,
    this.publishedOn,
    this.summary,
    this.practicalImpact,
    this.importantPoints,
    this.target,
  });

  final String title;
  final String url;
  final SourceConfig source;
  final NewsCategory category;

  /// 公式サイトでの公表日（'YYYY-MM-DD'）。指定しない場合は、日次フィード
  /// 生成時に公式ページの「公表日」「掲載日」「更新日」表記から読み取る
  /// （PDF等で読み取れない場合はここで指定する）。
  final String? publishedOn;

  final String? summary;
  final String? practicalImpact;
  final List<String>? importantPoints;
  final String? target;

  bool get hasCuratedContent => summary != null;

  DateTime? get publishedDate =>
      publishedOn == null ? null : DateTime.parse(publishedOn!);
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
  PinnedArticle(
    title: '労働安全衛生法及び作業環境測定法の改正（2026年1月・4月・10月 順次施行）',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/anzen/an-eihou/index_00001.html',
    source: mhlwSource,
    category: NewsCategory.lawChange,
    summary:
        '令和7年法律第33号により労働安全衛生法及び作業環境測定法が改正され、2026年1月から2029年にかけて段階的に施行されます。'
        '個人事業者等（フリーランス等）を安全衛生対策の対象に加えるほか、化学物質による健康障害防止対策、機械等による労働災害防止対策、'
        '高年齢労働者の労働災害防止対策など、幅広い分野の見直しが行われます。',
    practicalImpact:
        '顧問先が個人事業者（一人親方・フリーランス等）と同じ場所で作業させている場合や、化学物質を取り扱う事業場、'
        '高年齢労働者を雇用する事業場では、施行時期に応じた安全衛生管理体制の見直しが必要になります。',
    importantPoints: [
      '個人事業者等への安全衛生対策の推進（発注者・個人事業者双方に新たな義務）',
      '化学物質による健康障害防止対策の強化（SDS作成対象物質の追加等）',
      '機械等による労働災害の防止に関するルール見直し',
      '高年齢労働者の労働災害防止の推進（努力義務の強化）',
    ],
    target: '個人事業者と同一の場所で作業を発注する事業者、化学物質を取り扱う事業場、高年齢労働者を雇用する事業場など',
  ),
  PinnedArticle(
    title: '女性活躍推進法の改正（2026年4月1日施行）',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000091025.html',
    source: mhlwSource,
    category: NewsCategory.lawChange,
    summary:
        '女性活躍推進法の改正により、2026年4月1日から「男女間賃金差異」の情報公表義務の対象が常時雇用労働者301人超の'
        '事業主から101人以上の事業主に拡大されるとともに、新たに「女性管理職比率」の公表も義務づけられます。'
        '101〜300人の事業主は、この2項目を含む4項目のうち1項目以上の公表が必要です。',
    practicalImpact:
        '常時雇用労働者101人以上の顧問先では、施行後最初に終了する事業年度の実績を、翌事業年度開始後おおむね3か月以内に'
        '公表する体制を整える必要があります。',
    importantPoints: [
      '「男女間賃金差異」の公表義務対象が301人超→101人以上に拡大',
      '新たに「女性管理職比率」の公表を義務づけ',
      '公表は「女性の活躍推進企業データベース」等を通じて行うのが一般的',
      '初回公表は施行後最初に終了する事業年度分から',
    ],
    target: '常時雇用する労働者数101人以上の事業主',
  ),
  PinnedArticle(
    title: '在職老齢年金の支給停止基準額引き上げ（2026年4月）',
    url: 'https://www.gov-online.go.jp/tokusyu/roureinenkin/',
    source: govOnlineSource,
    category: NewsCategory.lawChange,
    summary:
        '在職老齢年金制度について、2026年4月から年金と賃金の合計に応じて年金の一部または全部が支給停止となる基準額が、'
        '月額51万円から65万円に引き上げられます。法改正によるベースアップと物価変動による例年の改定が重なったことによる'
        '大幅な引き上げです。',
    practicalImpact:
        '60歳以降も就労を続ける従業員の給与設計や、継続雇用時の賃金水準の検討にあたり、年金の支給停止額の見積もりが'
        '変わります。顧問先の高齢従業員向け説明資料の更新が必要です。',
    importantPoints: [
      '支給停止基準額が月額51万円から65万円に引き上げ',
      '基準額以下であれば老齢厚生年金が全額支給される',
      '60歳以降の就労継続を検討する従業員への影響が大きい',
    ],
    target: '60歳以降も就労し老齢厚生年金を受給する従業員、およびその雇用主',
  ),
  PinnedArticle(
    title: 'カスタマーハラスメント・求職者等セクシュアルハラスメント防止措置の義務化（2026年10月1日施行）',
    url: 'https://www.mhlw.go.jp/web_magazine/series/20260820.html',
    source: mhlwSource,
    category: NewsCategory.lawChange,
    summary:
        '2026年10月1日から、改正労働施策総合推進法により「カスタマーハラスメント」と「求職者等に対するセクシュアル'
        'ハラスメント」の防止措置が事業主の義務となります。\n\n'
        '職場における「カスタマーハラスメント」とは、①顧客等の言動であって、②その雇用する労働者が従事する業務の'
        '性質その他の事情に照らして社会通念上許容される範囲を超えたものにより、③労働者の就業環境が害されるもの'
        'であり、①〜③の要素をすべて満たすものをいいます。電話やSNS等インターネット上で行われるものも含まれます。',
    practicalImpact:
        '全事業主が対象となるため、就業規則・相談窓口・対応フローの整備が必須になります。求職者等セクハラでは'
        '面接・面談の実施方法（複数名対応や記録の保持等）の見直しも必要です。',
    importantPoints: [
      '【カスタマーハラスメント】事業主の方針等の明確化及びその周知・啓発',
      '【カスタマーハラスメント】相談体制の整備、事後の迅速かつ適切な対応',
      '【カスタマーハラスメント】プライバシー保護・不利益取扱いの禁止の定めと周知等',
      '【求職者等セクハラ】方針の明確化・周知啓発、相談体制の整備、事後対応、プライバシー保護等も同様に義務化',
    ],
    target: 'すべての事業主（業種・規模を問わず対象）',
  ),
  PinnedArticle(
    title: '子ども・子育て支援金制度の創設（2026年度）',
    url: 'https://www.cfa.go.jp/policies/kodomokosodateshienkinseido',
    source: cfaSource,
    category: NewsCategory.lawChange,
    summary:
        'こども家庭庁の少子化対策強化の財源として「子ども・子育て支援金制度」が創設され、2026年度から医療保険料と'
        'あわせて徴収が始まります。被用者保険については2026年4月分保険料（5月納付分）から、健康保険料・介護保険料と'
        'あわせて徴収され、令和8年度の支援金率は一律0.23%です（事業主負担あり）。',
    practicalImpact:
        '健康保険料の給与控除額が支援金分だけ増加するため、給与明細への記載や従業員への周知、保険料計算の見直しが'
        '必要になります。事業主負担分もあわせて発生します。',
    importantPoints: [
      '「子ども・子育て支援金制度」が2026年度に創設',
      '医療保険料（健康保険料・介護保険料）とあわせて徴収（2026年4月分保険料から）',
      '令和8年度の支援金率は一律0.23%（労使折半、事業主負担あり）',
      '給与明細等への記載・従業員への周知対応が必要',
    ],
    target: '全事業主および被用者保険（健康保険等）の被保険者',
  ),
  PinnedArticle(
    title: '現物給与の価額改定について（令和8年度）',
    url: 'https://www.mhlw.go.jp/content/001677803.pdf',
    source: mhlwSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '社会保険の現物給与（食事・住宅で支払われる報酬等）の価額が令和8年度に改定されます。食事による現物給与の'
        '価額は令和8年4月1日から、住宅による現物給与の価額は令和8年10月1日から新しい額が適用されます。住宅の'
        '現物給与は、居住面積1畳あたりの価額から総面積1平方メートルあたりの価額へと計算方法自体も変更されます。',
    practicalImpact:
        '食事・住宅を提供している事業所では、標準報酬月額の算定に用いる現物給与の価額表を4月分・10月分でそれぞれ'
        '切り替える必要があります。特に住宅は計算方法自体が変わるため、給与計算システムや算定基礎届の記載内容の'
        '見直しが必要です。',
    importantPoints: [
      '食事の現物給与価額は令和8年4月1日から新価額を適用',
      '住宅の現物給与価額は令和8年10月1日から新価額・新計算方法（1畳あたり→1平方メートルあたり）を適用',
      '都道府県ごとに価額が定められているため、該当都道府県の最新価額表の確認が必要',
      '標準報酬月額算定・随時改定・算定基礎届の記載に影響',
    ],
    target: '食事・社宅等の現物給与を提供している事業主、給与計算・社会保険手続き担当者',
  ),
  PinnedArticle(
    title: '協会けんぽ 令和8年度保険料率改定（3月分・4月納付分から）',
    url: 'https://www.kyoukaikenpo.or.jp/lp/2026hokenryou/',
    source: kyoukaikenpoSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '全国健康保険協会（協会けんぽ）の令和8年度保険料率が改定され、令和8年3月分（4月納付分）から適用されます。'
        '健康保険料率は都道府県ごとに毎年見直されるため、都道府県によって引き上げ・引き下げが異なります。介護保険'
        '料率は全国一律で、令和7年度の1.59%から令和8年度は1.62%に引き上げられます。',
    practicalImpact:
        '給与計算では、3月分給与（4月納付分）から新しい保険料率での控除に切り替える必要があります。都道府県単位'
        '保険料率が変更されるため、本社・支店等で加入している都道府県が異なる場合は、それぞれの新料率を確認する'
        '必要があります。',
    importantPoints: [
      '健康保険料率は都道府県ごとに異なり、令和8年3月分（4月納付分）から改定',
      '介護保険料率は全国一律で1.59%→1.62%に引き上げ',
      '給与計算ソフトの保険料率テーブルの更新が必要',
      '40歳到達・65歳到達による介護保険料の徴収要否の確認も定例業務として発生',
    ],
    target: '協会けんぽに加入する事業主、給与計算担当者',
  ),
  PinnedArticle(
    title: '令和8年度雇用保険料率の改定（引き下げ）',
    url: 'https://www.mhlw.go.jp/content/001692566.pdf',
    source: mhlwSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '令和8年4月1日から令和9年3月31日までの雇用保険料率が、前年度から0.1%引き下げられます。一般の事業は'
        '13.5/1000（労働者負担分・事業主負担分がそれぞれ0.05%ずつ引き下げ）、建設の事業は16.5/1000、'
        '農林水産・清酒製造の事業は15.5/1000となります。',
    practicalImpact:
        '4月1日以降に最初に到来する賃金締切日以降の給与から新しい雇用保険料率を適用する必要があります。給与'
        '計算ソフトの雇用保険料率設定の更新を4月支給分までに完了させる必要があります。',
    importantPoints: [
      '一般の事業の雇用保険料率は13.5/1000に引き下げ（労使ともに0.05%引き下げ）',
      '建設の事業は16.5/1000、農林水産・清酒製造の事業は15.5/1000',
      '適用開始は令和8年4月1日以降最初の賃金締切日から',
      '育児休業給付費充当徴収保険率（0.4%）は据え置き',
    ],
    target: '雇用保険適用事業所の事業主、給与計算担当者',
  ),
  PinnedArticle(
    title: '令和8年度税制改正による所得税基礎控除引き上げと年末調整様式の改正',
    url: 'https://www.nta.go.jp/users/gensen/2026kiso/index.htm',
    source: ntaSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '令和8年度税制改正により、所得税の基礎控除・給与所得控除の見直しが行われ、給与所得者の課税最低限が'
        '178万円に引き上げられます（基礎控除104万円＋給与所得控除最低保障74万円）。扶養親族等の所得要件も、'
        '給与収入のみの場合103万円以下から123万円以下に緩和されるほか、19歳以上23歳未満の親族向けに'
        '「特定親族特別控除」が新設されます。これに伴い、基礎控除申告書・配偶者控除等申告書・特定親族特別控除'
        '申告書などの年末調整様式が改正されます。',
    practicalImpact:
        '年末調整・源泉徴収事務では、新しい控除額・所得要件に対応した令和8年分の申告書様式を用いる必要があり'
        'ます。給与計算ソフトの源泉徴収税額表・年末調整計算ロジックの更新も必要になります。',
    importantPoints: [
      '給与所得者の課税最低限が178万円に引き上げ',
      '扶養親族の所得要件が給与収入123万円以下に緩和',
      '19〜22歳の親族向けに「特定親族特別控除」を新設（控除額3万〜63万円）',
      '基礎控除申告書・配偶者控除等申告書・特定親族特別控除申告書等の様式が改正され、令和8年分の年末調整から使用',
    ],
    target: '給与支払事業者、年末調整・源泉徴収事務を担当する給与計算担当者、社労士・税理士',
  ),
  PinnedArticle(
    title: '令和8年度算定基礎届の提出（標準報酬月額の定時決定）',
    url: 'https://www.nenkin.go.jp/tokusetsu/santei.html',
    source: nenkinSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '社会保険の標準報酬月額を見直す定時決定（算定基礎届）について、令和8年度は7月1日から7月10日までの間に'
        '提出する必要があります。6月中旬以降、日本年金機構から対象事業所へ算定基礎届の用紙等が順次送付されます。'
        '提出方法は電子申請（e-Gov・GビズID）、郵送、窓口持参から選択できますが、特定の法人には電子申請が'
        '義務付けられています。',
    practicalImpact:
        '提出期限までに、対象となる被保険者全員の4〜6月の報酬月額を集計し、標準報酬月額を算定・届出する必要が'
        'あります。現物給与を支給している場合は、現物給与価額改定（4月適用分）を反映した金額での算定が必要です。',
    importantPoints: [
      '提出期間は令和8年7月1日（水）から7月10日（金）まで',
      '6月中旬以降、日本年金機構から対象事業所へ用紙等が順次送付',
      '特定法人は電子申請（e-Gov・GビズID）が義務、それ以外は郵送・窓口も可',
      '現物給与を含む報酬がある場合は改定後の現物給与価額表での算定が必要',
    ],
    target: '社会保険適用事業所の事業主、給与計算・社会保険手続き担当者、社労士',
  ),
  PinnedArticle(
    title: '国民年金保険料の育児免除制度',
    url: 'https://www.nenkin.go.jp/service/kokunen/menjo/ikujimenjo.html',
    source: nenkinSource,
    publishedOn: '2026-10-01',
    category: NewsCategory.lawChange,
    summary:
        '2026（令和8）年10月から、国民年金第1号被保険者（20歳以上60歳未満の自営業者・農業者・学生・無職の方等）'
        'を対象に、子を養育する実父母・養父母について、国民年金保険料の納付が免除される「育児免除制度」が新たに'
        '始まりました。所得要件はなく、届出により免除されます。免除された期間は保険料を納付したものとして老齢'
        '基礎年金の受給額に反映されます。実母で産前産後免除期間がある場合はその期間に引き続く9カ月間、実父・養父母'
        '（産前産後免除のない実母を含む）は子を養育することとなった月から1歳の誕生日の前月までの最大12カ月間が'
        '対象です（いずれも令和8年10月1日以降の月分に限る）。制度施行前から1歳未満の子を養育していた場合の経過'
        '措置もあり、基礎年金番号とマイナンバーの紐付け等により親子関係・同一世帯が日本年金機構で確認できる実母'
        '（産前産後免除届出済み）は届出不要で、それ以外（実父・養父母、産前産後免除未届出の実母）は届出が必要です。',
    practicalImpact:
        '顧問先に自営業者・フリーランス等（第1号被保険者）がいる場合、出産・育児を機に本人から保険料負担についての'
        '相談を受ける場面が増えると見込まれます。会社員・公務員等（第2号被保険者）は対象外で、厚生年金保険料等の'
        '産前産後休業・育児休業等期間の免除制度（既存制度）を利用する点との違いを説明できるようにしておく必要が'
        'あります。また、実父・養父母は（実母と異なり）日本年金機構側での自動確認の対象外のため、必ず届出が必要な'
        '点を案内する必要があります。',
    importantPoints: [
      '国民年金第1号被保険者（自営業者・学生・無職の方等）が対象。所得要件はなし',
      '実母（産前産後免除あり）は産前産後免除に引き続き9カ月間、実父・養父母（産前産後免除のない実母を含む）は'
          '養育開始月から1歳の誕生日の前月まで最大12カ月間が対象（いずれも令和8年10月1日以降の月分に限る）',
      '制度施行（令和8年10月）前から1歳未満の子を養育していた場合も、経過措置により令和8年10月以降の月分が'
          '対象になる',
      '免除期間も保険料納付済期間として老齢基礎年金の受給額に反映（全額免除扱い）。育児免除期間中も付加保険料'
          '（月額400円）の納付が可能',
      'マイナンバー連携で親子関係等を確認できる実母（産前産後免除届出済み）は届出不要。実父・養父母や産前産後'
          '免除未届出の実母は必ず届出が必要（産前産後免除とあわせての届出も可）',
      '届出方法は住民登録先の市区町村窓口（郵送可）またはマイナポータルでの電子申請。添付書類は原則不要だが、'
          '外国籍の親子や特別養子縁組・養子縁組里親の場合は戸籍関係書類等の追加提出が必要',
      '子と同居しなくなった場合等、育児免除の要件に該当しなくなったときは終了の届出が必要（子が1歳に到達し'
          '期間満了となった場合は手続き不要）',
      '夫婦ともに第1号被保険者であれば、夫婦とも育児免除制度の対象になる',
      '第2号被保険者（厚生年金加入の会社員・公務員等）は対象外。別途、厚生年金保険料等の産前産後休業・育児休業等'
          '期間の免除制度を利用する',
    ],
    target: '国民年金第1号被保険者として子を養育する実父母・養父母（自営業者・フリーランス・農業者・学生・無職の方等）',
  ),
  PinnedArticle(
    title: '【事業主の皆さまへ】令和8年10月から一部の届書レイアウトを変更しました',
    url: 'https://www.nenkin.go.jp/oshirase/taisetu/jigyosho/2026/202610/100102.html',
    source: nenkinSource,
    publishedOn: '2026-10-01',
    category: NewsCategory.socialInsurance,
    summary:
        '日本年金機構は令和8年10月から、健康保険・厚生年金保険に関する一部の届書のレイアウト（様式）を変更しました。'
        '対象は、被保険者資格取得届／厚生年金保険70歳以上被用者該当届、健康保険被保険者適用除外承認申請書（国民健康'
        '保険組合被保険者）、被保険者資格喪失届／70歳以上被用者不該当届、被保険者区分変更届／70歳以上被用者区分変更'
        '届、特定適用事業所該当・不該当届、任意特定適用事業所申出書・取消申出書など。特に被保険者区分変更届では、'
        '新たに「特定減額特例対象者」の区分が追加されています。',
    practicalImpact:
        '令和8年10月以降に提出するこれらの届書は新しいレイアウトの様式を使用する必要があるため、様式・記入例を'
        '日本年金機構の各種届書ページから最新のものに差し替えておく必要があります。被保険者区分変更届に「特定減額'
        '特例対象者」の区分が新設されたのは、同時期に始まった短時間労働者の社会保険適用に係る賃金要件の撤廃・'
        '最低賃金の減額特例制度と連動した変更のため、該当する従業員がいる顧問先では区分選択を誤らないよう注意が'
        '必要です。',
    importantPoints: [
      '令和8年10月から、健康保険・厚生年金保険関係の複数の届書のレイアウトを変更',
      '対象届書: 被保険者資格取得届、被保険者資格喪失届、被保険者区分変更届（70歳以上被用者分を含む）、特定適用'
          '事業所該当・不該当届、任意特定適用事業所申出書・取消申出書など',
      '被保険者区分変更届に新たに「特定減額特例対象者」の区分を追加（短時間労働者の賃金要件撤廃・最低賃金減額'
          '特例と関連）',
      '様式・記入例は日本年金機構の各種届書ページから最新版をダウンロードする必要がある',
    ],
    target: '社会保険適用事業所の事業主、社会保険手続き担当者、社労士',
  ),
  PinnedArticle(
    title: '2026（令和8）年10月に社会保険の短時間労働者に係る賃金要件が撤廃されました',
    url: 'https://www.nenkin.go.jp/oshirase/taisetu/jigyosho/2026/202610/100104.html',
    source: nenkinSource,
    publishedOn: '2026-10-01',
    category: NewsCategory.lawChange,
    summary:
        '令和7年年金制度改正法（令和7年法律第74号）に基づき、短時間労働者が社会保険（健康保険・厚生年金保険）に'
        '加入する要件のうち、賃金要件（所定内賃金が月額8.8万円以上であること）が2026年10月1日に撤廃されました。'
        'これまでの加入要件は①賃金要件②労働時間要件（週の所定労働時間20時間以上）③企業規模要件（勤め先が従業員'
        '数51人以上の企業）④学生でないこと、の4つでしたが、①が撤廃され②〜④を満たす短時間労働者は社会保険の'
        '加入対象となります。なお、2027年10月以降は企業規模要件の対象事業所範囲が段階的に拡大される予定です'
        '（従業員数50人以下の事業所でも労使合意に基づく申出により加入させることが可能）。',
    practicalImpact:
        '賃金要件の撤廃により、月額8.8万円未満の短時間労働者でも、労働時間・企業規模・学生でないことの要件を'
        '満たせば新たに社会保険の加入対象となります。顧問先では、対象となる短時間労働者の洗い出しと資格取得手続き'
        '（被保険者資格取得届の提出）、本人への保険料負担・保障内容の説明が必要になります。一方、最低賃金の減額'
        '特例許可を受けている「特定減額特例対象者」（所定内賃金月額8.8万円未満）は、引き続き原則として加入対象外'
        'です（別記事参照）。',
    importantPoints: [
      '短時間労働者の社会保険加入要件のうち、賃金要件（所定内賃金月額8.8万円以上）が2026年10月1日に撤廃',
      '残る加入要件は、労働時間要件（週20時間以上）・企業規模要件（従業員51人以上）・学生でないこと、の3つ',
      '2027年10月以降、企業規模要件の対象事業所範囲が段階的に拡大予定（50人以下の事業所も労使合意に基づく'
          '申出で加入可能）',
      '最低賃金の減額特例許可を受けている「特定減額特例対象者」（所定内賃金月額8.8万円未満）は、引き続き原則'
          '社会保険の加入対象外',
    ],
    target: '短時間労働者を雇用する事業主、社会保険手続き担当者、社労士',
  ),
  PinnedArticle(
    title: '最低賃金の減額特例の対象者に関する制度が始まります！',
    url: 'https://www.nenkin.go.jp/oshirase/topics/2021/0219.files/tirashi_gengaku.pdf',
    source: nenkinSource,
    category: NewsCategory.lawChange,
    summary:
        '2026年10月1日の短時間労働者の社会保険加入に係る賃金要件撤廃にあわせて、最低賃金法第7条の最低賃金減額の'
        '特例許可を受けている労働者（特定減額特例対象者）に関する制度が始まりました。特定減額特例対象者とは、'
        '①精神又は身体の障害により著しく労働能力の低い方、②試の使用期間中の方、③基礎的な技能等を内容とする'
        '認定職業訓練を受けている方のうち厚生労働省令で定める方、④軽易な業務に従事する方、⑤断続的労働に従事'
        'する方のいずれかに該当し、かつ所定内賃金が月額8.8万円未満の方です。これらの方は、賃金要件撤廃後も'
        '原則として社会保険の加入対象外のままですが、申出により社会保険に加入することができます（保険料は他の'
        '被保険者と同様に労使折半）。',
    practicalImpact:
        '顧問先に最低賃金の減額特例許可を受けている従業員（障害者雇用、試用期間中の者等）がいる場合、当該従業員'
        'から社会保険加入の希望があれば、事業主が「被保険者資格取得届」（備考欄に「特定減額特例対象者の任意取得」'
        'を選択）と従業員からの申出書をあわせて日本年金機構に提出する必要があります。加入後、従業員の申出による'
        '任意喪失（資格喪失届の喪失原因欄に「特定減額特例対象者の任意喪失」を選択）も可能です。いずれも事業主の'
        '同意は不要で、従業員からの申出があれば遅滞なく届出する必要があります。',
    importantPoints: [
      '特定減額特例対象者（最低賃金減額特例許可を受け、所定内賃金月額8.8万円未満の方）は、賃金要件撤廃後も原則'
          '社会保険の加入対象外',
      '対象: 障害により労働能力が著しく低い方、試用期間中の方、認定職業訓練受講者、軽易な業務従事者、断続的'
          '労働従事者',
      '申出により社会保険に加入可能。保険料は他の被保険者と同様に労使折半',
      '加入時は「被保険者資格取得届」（備考欄「特定減額特例対象者の任意取得」）＋従業員の申出書を事業主が日本'
          '年金機構へ提出。受理日に資格取得',
      '任意喪失も可能（「被保険者資格喪失届」の喪失原因欄「特定減額特例対象者の任意喪失」を選択、受理日の翌日に'
          '資格喪失）。いずれも事業主の同意は不要',
    ],
    target: '最低賃金の減額特例許可を受けている労働者を雇用する事業主、社会保険手続き担当者、社労士',
  ),
  PinnedArticle(
    title: '年末調整がよくわかるページ（令和8年分）',
    url: 'https://www.nta.go.jp/users/gensen/nencho/index.htm',
    source: ntaSource,
    category: NewsCategory.salaryCalculation,
    summary:
        '国税庁の「年末調整がよくわかるページ」に、令和8年分の年末調整に関する最新情報が公開されています。令和8年'
        '分の年末調整では、基礎控除の引上げ、給与所得控除の最低保障額の引上げ、扶養親族等の所得要件の改正に加え、'
        '新たに「年齢23歳未満の扶養親族を有する場合の生命保険料控除の特例」が創設されています。源泉徴収義務者'
        '向けには、年末調整の手順を解説する動画・パンフレット・各種様式のほか、源泉徴収簿等を用いた計算を効率化'
        'する「年末調整計算シート」（Excel）やリーフレットが提供されています。',
    practicalImpact:
        '所得税基礎控除引上げ・扶養親族所得要件の改正（別記事参照）に加え、新設された「生命保険料控除の特例」に'
        'ついても確認が必要です。対象となりうる19〜22歳台の扶養親族（特定親族特別控除と近い年齢層）がいる従業員'
        'の年末調整では、控除額の計算方法に影響する可能性があります。給与計算システムを持たない小規模な顧問先'
        'では「年末調整計算シート」（Excel）の活用が実務の効率化に役立ちます。',
    importantPoints: [
      '令和8年分の年末調整の変更点: 基礎控除の引上げ、給与所得控除の最低保障額の引上げ、扶養親族等の所得要件の'
          '改正',
      '新たに「年齢23歳未満の扶養親族を有する場合の生命保険料控除の特例」を創設',
      '国税庁が源泉徴収義務者向けにリーフレット・年末調整計算シート（Excel）・動画解説・各種様式を提供',
      '基礎控除引上げ・特定親族特別控除の詳細は「令和8年度税制改正による所得税基礎控除引き上げと年末調整様式の'
          '改正」の記事もあわせて参照',
    ],
    target: '給与支払事業者、年末調整・源泉徴収事務を担当する給与計算担当者、社労士・税理士',
  ),
  PinnedArticle(
    title: '同一労働同一賃金ガイドライン等の改正',
    url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000144972.html',
    source: mhlwSource,
    category: NewsCategory.lawChange,
    summary:
        '2026年10月、同一労働同一賃金ガイドライン等が改正されました。短時間・有期雇用労働者及び派遣労働者について、'
        '正社員との待遇差の判断にあたり考慮すべき待遇の種類に、賞与・退職手当・無事故手当・家族手当・住宅手当・'
        '福利厚生施設・病気休職・夏季冬季休暇・褒賞に関する記載が新たに追加されました。あわせて、雇入れ時・派遣時'
        'の労働条件明示事項に、「待遇の相違の内容・理由等に関する説明を求めることができる旨」の明示が新たに'
        '義務付けられています。',
    practicalImpact:
        '短時間・有期雇用労働者や派遣労働者を雇用する事業主（派遣元・派遣先を含む）は、採用時に交付する労働条件'
        '通知書等に、待遇差の説明を求められる旨の明示事項を追加する必要があります。また、正社員との待遇差を説明'
        'する際の判断材料として、新たに追加された賞与・各種手当・福利厚生・休暇等の待遇項目についても、顧問先の'
        '待遇制度を整理・点検しておく必要があります。',
    importantPoints: [
      '同一労働同一賃金ガイドライン等の改正により、待遇差の判断対象に賞与・退職手当・無事故手当・家族手当・'
          '住宅手当・福利厚生施設・病気休職・夏季冬季休暇・褒賞を新たに追加',
      '雇入れ時・派遣時の労働条件明示事項に「待遇の相違の内容・理由等に関する説明を求めることができる旨」の'
          '明示を新たに義務付け',
      '対象は短時間・有期雇用労働者とその事業主、派遣労働者とその派遣元事業主・派遣先',
      '施行は2026年10月',
    ],
    target: '短時間労働者・有期雇用労働者・派遣労働者を雇用する事業主、派遣元・派遣先事業主、社労士',
  ),
  PinnedArticle(
    title: '令和8年度地域別最低賃金改定状況',
    url: 'https://www.mhlw.go.jp/stf/newpage_74920.html',
    source: mhlwSource,
    category: NewsCategory.lawChange,
    summary:
        '令和8年度の地域別最低賃金改定額が決定し、2026年10月1日以降、各都道府県で順次発効しています。全ての'
        '都道府県で時間額54円から65円の引上げとなり、全国加重平均は1,177円です。',
    practicalImpact:
        '最低賃金は全事業主・全労働者に適用されるため、顧問先では発効日以降の賃金が各都道府県の新しい最低賃金'
        '額を下回っていないか確認が必要です。パート・アルバイト等の時給設定の見直しに加え、月給制の場合も所定'
        '労働時間で割った時間当たり賃金が最低賃金を下回っていないかのチェックが必要です。なお、全国の最低賃金が'
        '1,016円以上となったことが、短時間労働者の社会保険適用における賃金要件撤廃（別記事参照）の背景にも'
        'なっています。',
    importantPoints: [
      '令和8年度地域別最低賃金は、全都道府県で時間額54円〜65円の引上げ（2026年10月1日以降順次発効）',
      '全国加重平均は1,177円',
      '発効日は都道府県ごとに異なるため、顧問先の所在都道府県の発効日・新しい最低賃金額を個別に確認する必要が'
          'ある',
      '月給制の従業員についても、所定労働時間で割った時間当たり賃金が最低賃金を下回っていないかの確認が必要',
    ],
    target: '全ての事業主（業種・規模を問わず対象）、給与計算担当者、社労士',
  ),
];
