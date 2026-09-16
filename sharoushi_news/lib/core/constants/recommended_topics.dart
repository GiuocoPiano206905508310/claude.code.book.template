import '../../models/article.dart';

/// 設定画面でチェックできる「おすすめトピック」。
/// 記事のタイトル・概要にキーワードが含まれるかで判定する（AI分類は未実装）。
class RecommendedTopic {
  const RecommendedTopic({
    required this.id,
    required this.label,
    required this.keywords,
  });

  final String id;
  final String label;
  final List<String> keywords;
}

const List<RecommendedTopic> recommendedTopics = [
  RecommendedTopic(
    id: 'social_insurance',
    label: '社会保険',
    keywords: ['社会保険', '被保険者', '標準報酬'],
  ),
  RecommendedTopic(
    id: 'labor_standards',
    label: '労働基準',
    keywords: ['労働基準', '労働時間', '過労死', '安全衛生'],
  ),
  RecommendedTopic(
    id: 'minimum_wage',
    label: '最低賃金・賃上げ',
    keywords: ['最低賃金', '賃上げ'],
  ),
  RecommendedTopic(
    id: 'insurance',
    label: '雇用保険・労災保険',
    keywords: ['雇用保険', '労災保険', '労災'],
  ),
  RecommendedTopic(
    id: 'childcare_leave',
    label: '育児・介護休業',
    keywords: ['育児', '介護休業', '両立'],
  ),
  RecommendedTopic(
    id: 'equal_pay',
    label: '同一労働同一賃金・パート有期',
    keywords: ['パートタイム', '有期雇用', '同一労働同一賃金'],
  ),
  RecommendedTopic(id: 'harassment', label: 'ハラスメント', keywords: ['ハラスメント']),
  RecommendedTopic(id: 'foreign_worker', label: '外国人雇用', keywords: ['外国人']),
  RecommendedTopic(
    id: 'tax',
    label: '税務・年末調整',
    keywords: ['年末調整', '税務', '消費税'],
  ),
  RecommendedTopic(id: 'disability', label: '障害者雇用', keywords: ['障害者']),
  RecommendedTopic(id: 'subsidy', label: '助成金', keywords: ['助成金']),
  RecommendedTopic(id: 'freelance', label: 'フリーランス', keywords: ['フリーランス']),
  RecommendedTopic(
    id: 'elderly',
    label: '高年齢者雇用',
    keywords: ['高年齢者', '65歳', '70歳'],
  ),
];

/// 選択中のトピックIDのいずれかのキーワードが、記事のタイトル・概要に
/// 含まれていれば true。選択が空の場合は false（「おすすめ」タブは空表示）。
bool articleMatchesSelectedTopics(
  Article article,
  Set<String> selectedTopicIds,
) {
  if (selectedTopicIds.isEmpty) return false;
  final haystack = '${article.title} ${article.summary}';
  for (final topic in recommendedTopics) {
    if (!selectedTopicIds.contains(topic.id)) continue;
    if (topic.keywords.any(haystack.contains)) return true;
  }
  return false;
}
