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
    this.summary,
    this.practicalImpact,
    this.importantPoints,
    this.target,
  });

  final String title;
  final String url;
  final SourceConfig source;
  final NewsCategory category;
  final String? summary;
  final String? practicalImpact;
  final List<String>? importantPoints;
  final String? target;

  bool get hasCuratedContent => summary != null;
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
];
