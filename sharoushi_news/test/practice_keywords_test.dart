// isPracticeRelatedTitleの単体テスト。タイトルは厚生労働省の新着情報に
// 実際に載ったもの（GitHub Actions上で取得して確認）。
import 'package:flutter_test/flutter_test.dart';
import 'package:sharoushi_news/core/constants/practice_keywords.dart';

void main() {
  test('社労士実務の分野の記事は通す', () {
    for (final title in [
      '「シフト制」で働く場合の年次有給休暇について',
      '10月は年次有給休暇取得促進期間です。',
      '勤務時間が短い正規型の労働者として事業所に使用されている個人事業主等に係る被保険者資格の取扱い等について',
      '長時間労働が疑われる事業場に対する令和７年度の監督指導結果を公表します',
      '業種別カスタマーハラスメント対策マニュアルについて',
      '第58回社会保険労務士試験の合格者発表',
      '令和８年度雇用保険料率の改定（引き下げ）',
    ]) {
      expect(isPracticeRelatedTitle(title), isTrue, reason: title);
    }
  });

  test('医療・医薬・研究規制・国際保健等の記事は通さない', () {
    for (final title in [
      'ヒトゲノム編集胚等の取扱いの規制について',
      'インドネシアにおける入国前結核スクリーニングを開始します',
      'ＯＴＣ類似薬の保険給付の在り方の見直しについて（ＯＴＣ類似薬の一部保険外療養）',
      'WHOとの共同プレスリリースを公表しました',
      '造血幹細胞移植普及推進月間について',
    ]) {
      expect(isPracticeRelatedTitle(title), isFalse, reason: title);
    }
  });

  test('省名・大臣名に含まれる「労働」だけでは通さない', () {
    expect(isPracticeRelatedTitle('上野厚生労働大臣　閣議後記者会見のお知らせ'), isFalse);
    expect(isPracticeRelatedTitle('令和８年度 薬事功労者厚生労働大臣表彰を行います'), isFalse);
    expect(isPracticeRelatedTitle('厚生労働省改革実行チーム'), isFalse);
  });
}
