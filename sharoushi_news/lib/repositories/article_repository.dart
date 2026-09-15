import 'package:flutter/foundation.dart';

import '../models/article.dart';

/// 記事データへのアクセスを抽象化するリポジトリ（仕様セクション19）。
/// Phase 1〜2は [DummyArticleRepository] のみ。Phase 3以降でローカルDB版に、
/// 将来的にはクラウドDB版に差し替えられるよう、UI 側はこのインターフェース
/// だけに依存させる。
abstract class ArticleRepository extends ChangeNotifier {
  List<Article> get articles;

  Future<void> toggleFavorite(String id);
  Future<void> markAsRead(String id);
}

/// Phase 1〜2用のインメモリ実装。ダミーデータ15件を保持するのみで、
/// 実際のネットワークアクセス・永続化は行わない。
class DummyArticleRepository extends ArticleRepository {
  DummyArticleRepository() : _articles = _buildDummyArticles();

  List<Article> _articles;

  @override
  List<Article> get articles => List.unmodifiable(_articles);

  @override
  Future<void> toggleFavorite(String id) async {
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isFavorite: !a.isFavorite) else a,
    ];
    notifyListeners();
  }

  @override
  Future<void> markAsRead(String id) async {
    final target = _articles.firstWhere((a) => a.id == id);
    if (target.isRead) return;
    _articles = [
      for (final a in _articles)
        if (a.id == id) a.copyWith(isRead: true) else a,
    ];
    notifyListeners();
  }

  static List<Article> _buildDummyArticles() {
    DateTime d(int day) => DateTime(2026, 9, day);

    return [
      Article(
        id: 'a1',
        title: '育児・介護休業法の改正内容と企業対応の実務ポイント',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a1',
        publishedAt: d(15),
        fetchedAt: d(15),
        category: NewsCategory.lawChange,
        summary: '育児・介護休業法の改正により、柔軟な働き方を実現するための措置の選択的義務化などが定められました。就業規則の見直しが必要になる企業が多く見込まれます。',
        practicalImpact: '就業規則・育児介護休業規程の改定、対象従業員への周知、労使協定の見直しが必要になります。施行日までに社内制度を整備しておく必要があります。',
        importantPoints: const [
          '柔軟な働き方を実現するための措置の選択的義務化',
          '3歳未満の子を養育する従業員への個別周知・意向確認の義務化',
          '育児休業取得状況の公表義務の対象拡大',
        ],
        deadline: '2026年4月1日までに就業規則改定',
        target: '全企業（一部措置は従業員数により対象範囲が異なる）',
        importance: 3,
        contentHash: 'hash-a1',
      ),
      Article(
        id: 'a2',
        title: '中小企業におけるハラスメント防止措置の義務化',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a2',
        publishedAt: d(14),
        fetchedAt: d(15),
        category: NewsCategory.lawChange,
        summary: 'これまで努力義務であった中小企業のパワーハラスメント防止措置が義務化されます。相談窓口の設置や就業規則への明記が求められます。',
        practicalImpact: '相談窓口の設置状況の点検、ハラスメント防止規程の整備、管理職向け研修の実施を検討する必要があります。',
        importantPoints: const [
          '相談窓口の設置・周知が義務化',
          '就業規則等へのハラスメント禁止規定の明記',
          '再発防止のための措置の実施',
        ],
        deadline: null,
        target: '中小企業を含む全企業',
        importance: 3,
        contentHash: 'hash-a2',
        isRead: true,
      ),
      Article(
        id: 'a3',
        title: '令和8年度 地域別最低賃金改定の目安を公表',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a3',
        publishedAt: d(15),
        fetchedAt: d(15),
        category: NewsCategory.labor,
        summary: '中央最低賃金審議会が示した引上げ額の目安が公表されました。各都道府県で今後、地方審議会による答申が行われる予定です。',
        practicalImpact: '給与計算における最低賃金チェックの対象額の見直しが必要です。発効日以降の給与が最低賃金を下回らないよう確認してください。',
        importantPoints: const [
          '全国加重平均額の引上げ目安が公表',
          '都道府県ごとの答申は今後順次公表予定',
          '発効日は例年10月が目安',
        ],
        deadline: '発効日までに賃金確認',
        target: '全企業',
        importance: 2,
        contentHash: 'hash-a3',
      ),
      Article(
        id: 'a4',
        title: '算定基礎届の提出時期と留意点について',
        sourceName: '日本年金機構',
        sourceUrl: 'https://www.nenkin.go.jp/',
        canonicalUrl: 'https://www.nenkin.go.jp/sample/a4',
        publishedAt: d(13),
        fetchedAt: d(15),
        category: NewsCategory.socialInsurance,
        summary: '定時決定（算定基礎届）の提出時期と、記載にあたっての留意点が案内されています。電子申請での提出方法も紹介されています。',
        practicalImpact: '4〜6月の報酬額の集計、支払基礎日数の確認、対象外となる従業員の整理を行った上で届出を準備してください。',
        importantPoints: const [
          '提出期間は例年7月1日〜10日',
          '電子申請（e-Gov）での提出が推奨されている',
          '随時改定に該当する場合は月額変更届が優先',
        ],
        deadline: '7月10日まで',
        target: '厚生年金保険の適用事業所',
        importance: 2,
        contentHash: 'hash-a4',
      ),
      Article(
        id: 'a5',
        title: '月額変更届（随時改定）の要件と実務上の注意点',
        sourceName: '日本年金機構',
        sourceUrl: 'https://www.nenkin.go.jp/',
        canonicalUrl: 'https://www.nenkin.go.jp/sample/a5',
        publishedAt: d(11),
        fetchedAt: d(15),
        category: NewsCategory.socialInsurance,
        summary: '固定的賃金の変動があった際の随時改定（月額変更届）について、対象となる要件と提出時の注意点がまとめられています。',
        practicalImpact: '固定的賃金の変動があった従業員について、3か月平均額と現在の標準報酬月額との差を確認し、2等級以上の差がある場合は届出が必要です。',
        importantPoints: const [
          '固定的賃金の変動月から3か月間の平均で判定',
          '2等級以上の差があることが要件の一つ',
          '支払基礎日数が17日未満の月は算定対象外',
        ],
        deadline: null,
        target: '厚生年金保険の適用事業所',
        importance: 1,
        contentHash: 'hash-a5',
        isRead: true,
      ),
      Article(
        id: 'a6',
        title: '賞与支払届の提出方法と記載上の注意',
        sourceName: '日本年金機構',
        sourceUrl: 'https://www.nenkin.go.jp/',
        canonicalUrl: 'https://www.nenkin.go.jp/sample/a6',
        publishedAt: d(9),
        fetchedAt: d(15),
        category: NewsCategory.socialInsurance,
        summary: '賞与を支給した際に提出する賞与支払届について、提出期限や標準賞与額の上限の考え方が案内されています。',
        practicalImpact: '賞与支給日から5日以内の届出が必要です。標準賞与額には年度累計の上限があるため、複数回賞与を支給する場合は累計額の管理が必要です。',
        importantPoints: const [
          '支給日から5日以内に提出',
          '健康保険の標準賞与額は年度累計573万円が上限',
          '厚生年金保険の標準賞与額は1回の支給で150万円が上限',
        ],
        deadline: '支給日から5日以内',
        target: '厚生年金保険の適用事業所',
        importance: 1,
        contentHash: 'hash-a6',
      ),
      Article(
        id: 'a7',
        title: '雇用保険料率の改定について',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a7',
        publishedAt: d(10),
        fetchedAt: d(15),
        category: NewsCategory.employmentInsurance,
        summary: '次年度の雇用保険料率の改定内容が公表されました。労働者負担分・事業主負担分それぞれの料率が見直されます。',
        practicalImpact: '給与計算システムの雇用保険料率設定を、施行日に合わせて更新する必要があります。',
        importantPoints: const [
          '一般の事業・農林水産清酒製造の事業・建設の事業で料率が異なる',
          '施行日は例年4月1日',
          '育児休業給付に係る保険料率も併せて改定',
        ],
        deadline: '施行日までにシステム更新',
        target: '雇用保険の適用事業所',
        importance: 2,
        contentHash: 'hash-a7',
      ),
      Article(
        id: 'a8',
        title: '65歳超雇用推進助成金の申請要件が一部変更',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a8',
        publishedAt: d(8),
        fetchedAt: d(15),
        category: NewsCategory.subsidy,
        summary: '高年齢者の雇用環境整備を行った事業主向けの助成金について、申請要件と助成額の一部が見直されています。',
        practicalImpact: '制度導入を検討している場合は、変更後の要件を確認した上で、計画届の提出時期を見直す必要があります。',
        importantPoints: const [
          '65歳への定年引上げ等のコースで要件が一部変更',
          '支給申請には事前の計画届提出が必要',
          '生産性要件による割増措置あり',
        ],
        deadline: null,
        target: '高年齢者雇用環境整備を行う事業主',
        importance: 1,
        contentHash: 'hash-a8',
      ),
      Article(
        id: 'a9',
        title: '令和8年度の年金額改定について',
        sourceName: '日本年金機構',
        sourceUrl: 'https://www.nenkin.go.jp/',
        canonicalUrl: 'https://www.nenkin.go.jp/sample/a9',
        publishedAt: d(7),
        fetchedAt: d(15),
        category: NewsCategory.pension,
        summary: '物価・賃金の変動を踏まえた年金額の改定内容が公表されました。老齢基礎年金・老齢厚生年金の見込額に影響します。',
        practicalImpact: '顧問先の従業員から年金額に関する問い合わせがあった場合の説明資料として確認しておくとよい内容です。',
        importantPoints: const [
          '改定率は物価変動率・賃金変動率等を踏まえて決定',
          '新規裁定者・既裁定者で改定の考え方が異なる',
          '在職老齢年金の支給停止調整額も見直し',
        ],
        deadline: null,
        target: '年金受給者・受給予定者',
        importance: 2,
        contentHash: 'hash-a9',
      ),
      Article(
        id: 'a10',
        title: 'ねんきん定期便の電子化（ねんきんネット連携）が進行',
        sourceName: '日本年金機構',
        sourceUrl: 'https://www.nenkin.go.jp/',
        canonicalUrl: 'https://www.nenkin.go.jp/sample/a10',
        publishedAt: d(5),
        fetchedAt: d(15),
        category: NewsCategory.pension,
        summary: 'ねんきん定期便について、ねんきんネットでの電子閲覧への切り替えを案内する取り組みが進められています。',
        practicalImpact: '従業員からねんきんネットの登録方法について質問を受けるケースが増えることが見込まれます。',
        importantPoints: const [
          'ねんきんネットの利用登録にはマイナンバーカード連携が便利',
          '紙の定期便は引き続き節目年齢で送付',
        ],
        deadline: null,
        target: '全被保険者',
        importance: 1,
        contentHash: 'hash-a10',
        isRead: true,
      ),
      Article(
        id: 'a11',
        title: '労災保険率の改定について',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a11',
        publishedAt: d(6),
        fetchedAt: d(15),
        category: NewsCategory.labor,
        summary: '業種ごとの労災保険率が改定されます。労働保険年度更新の際の確定保険料算定に影響します。',
        practicalImpact: '労働保険年度更新の申告書作成時に、新料率を適用する時期を誤らないよう確認が必要です。',
        importantPoints: const [
          '業種区分ごとに料率が異なる',
          '改定は原則3年ごとに実施',
          '年度更新の申告書様式にも変更がある場合がある',
        ],
        deadline: null,
        target: '労災保険の適用事業所',
        importance: 2,
        contentHash: 'hash-a11',
      ),
      Article(
        id: 'a12',
        title: '就業規則届出の電子申請対応が拡大',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a12',
        publishedAt: d(4),
        fetchedAt: d(15),
        category: NewsCategory.labor,
        summary: '就業規則の届出について、e-Govを通じた電子申請への対応が拡大されています。添付書類の様式も一部変更されています。',
        practicalImpact: '複数の労働基準監督署への届出を行っている場合、電子申請により事務負担を軽減できる可能性があります。',
        importantPoints: const [
          'e-Gov経由での電子申請が可能な手続が拡大',
          '意見書の様式が一部更新',
        ],
        deadline: null,
        target: '常時10人以上を使用する事業場',
        importance: 1,
        contentHash: 'hash-a12',
      ),
      Article(
        id: 'a13',
        title: '外国人雇用状況の届出義務に関する留意事項',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a13',
        publishedAt: d(3),
        fetchedAt: d(15),
        category: NewsCategory.labor,
        summary: '外国人労働者の雇入れ・離職時に義務付けられている届出について、在留資格確認の方法を含めた留意事項が案内されています。',
        practicalImpact: '外国人労働者を雇用する際は、在留カードによる在留資格・在留期間の確認と、届出期限の管理が必要です。',
        importantPoints: const [
          '雇用保険被保険者でない場合も届出が必要',
          '届出を怠ると罰則の対象となる場合がある',
          '在留資格の確認は雇入れ時に必須',
        ],
        deadline: null,
        target: '外国人労働者を雇用する全事業所',
        importance: 1,
        contentHash: 'hash-a13',
      ),
      Article(
        id: 'a14',
        title: '高年齢者雇用安定法に基づく70歳までの就業機会確保',
        sourceName: '厚生労働省',
        sourceUrl: 'https://www.mhlw.go.jp/',
        canonicalUrl: 'https://www.mhlw.go.jp/sample/a14',
        publishedAt: d(2),
        fetchedAt: d(15),
        category: NewsCategory.lawChange,
        summary: '70歳までの就業機会確保について、努力義務の各選択肢と導入企業の対応事例が紹介されています。',
        practicalImpact: '就業規則における継続雇用制度の対象年齢見直しや、業務委託契約による就業確保措置の検討が考えられます。',
        importantPoints: const [
          '定年引上げ・継続雇用制度・業務委託契約等の選択肢がある',
          '現時点では努力義務',
          '労使間での十分な協議が推奨されている',
        ],
        deadline: null,
        target: '全企業（努力義務）',
        importance: 2,
        contentHash: 'hash-a14',
      ),
      Article(
        id: 'a15',
        title: '社会保険適用拡大に伴う短時間労働者への対応',
        sourceName: '全国健康保険協会',
        sourceUrl: 'https://www.kyoukaikenpo.or.jp/',
        canonicalUrl: 'https://www.kyoukaikenpo.or.jp/sample/a15',
        publishedAt: d(1),
        fetchedAt: d(15),
        category: NewsCategory.socialInsurance,
        summary: '短時間労働者に対する社会保険の適用拡大について、対象となる企業規模や加入要件の考え方がまとめられています。',
        practicalImpact: '対象となる短時間労働者を洗い出し、資格取得届の提出準備と、本人への説明・同意取得を進める必要があります。',
        importantPoints: const [
          '週の所定労働時間・雇用期間の見込み等が加入要件',
          '対象事業所の企業規模要件は段階的に拡大',
          '本人への事前説明が実務上重要',
        ],
        deadline: '施行日までに加入手続き',
        target: '特定適用事業所（企業規模要件あり）',
        importance: 3,
        contentHash: 'hash-a15',
      ),
    ];
  }
}
