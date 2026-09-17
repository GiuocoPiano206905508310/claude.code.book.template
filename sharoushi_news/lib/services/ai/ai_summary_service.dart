import 'dart:convert';

import 'package:http/http.dart' as http;

/// GitHub Actions上での日次フィード生成時に、概要・実務影響・重要ポイント・
/// 対象・カテゴリーをAI（Claude API）で生成するためのサービス。
///
/// [ArticleExcerptService.fetchBodyText]で取得した本文抜粋（[summarize]の
/// bodyText引数）を渡せる場合はそれをもとに詳しく正確な内容を生成する。
/// 本文が取得できずタイトルのみの場合は「タイトルと一般的な制度知識からの
/// 推測」にとどめる、より控えめな内容になる。RSSは使用しない方針とは無関係
/// （AI要約は取得後の後処理であり、取得方法そのものではない）。
class AiSummary {
  const AiSummary({
    required this.summary,
    required this.practicalImpact,
    required this.importantPoints,
    required this.target,
    this.category,
  });

  final String summary;
  final String practicalImpact;
  final List<String> importantPoints;
  final String target;

  /// AIが判定したカテゴリー（[NewsCategory.name]の値）。判定不能・未対応の
  /// 値だった場合はnull（呼び出し側で一覧ページ由来のデフォルトを使う）。
  final String? category;
}

class AiSummaryService {
  AiSummaryService({required this.apiKey, http.Client? client})
    : _client = client ?? http.Client();

  static const _endpoint = 'https://api.anthropic.com/v1/messages';

  // ユーザーの希望によりClaude Haiku 4.5を使用する
  // （タイトルのみからの短い要約生成という用途には十分な品質であり、
  // より高性能なモデルに対して費用を抑えられるため）。
  static const _model = 'claude-haiku-4-5';

  final String apiKey;
  final http.Client _client;

  // 「法改正」は審議会の開催案内・記者会見・統計公表・啓発活動等と区別し、
  // 施行日や新たな義務・基準を伴う実際の法令改正のみを指す、という運用方針
  // （ユーザー指定）をAIにも徹底させるための分類定義。
  static const _categoryGuide = '''
カテゴリーは以下の定義に従い、最も適切な1つをNewsCategoryの値（英語名）で
判定してください:
- lawChange: 実際に成立・公布された法律の改正で、施行日や新たな義務・基準が
  明確にあるもの（例: 労働安全衛生法改正、女性活躍推進法改正、育児介護休業法
  改正、社会保険の適用拡大など）。審議会・分科会の開催案内、記者会見概要、
  統計・調査結果の公表、啓発キャンペーンはlawChangeに含めない。
- pamphlet: パンフレット・リーフレット・報告書等の案内
- labor: 労働条件・労働時間・ハラスメント等、法改正に該当しない労働分野の一般的な情報
- socialInsurance: 健康保険・厚生年金保険料等、社会保険手続きに関する情報
- employmentInsurance: 雇用保険に関する情報（法改正に該当しないもの）
- subsidy: 助成金・給付金に関する情報
- pension: 国民年金・厚生年金給付に関する情報（法改正に該当しないもの）
''';

  Future<AiSummary> summarize({
    required String title,
    required String sourceName,
    required String categoryLabel,
    String? bodyText,
  }) async {
    final hasBody = bodyText != null && bodyText.trim().isNotEmpty;
    final prompt = hasBody
        ? '''
あなたは日本の社会保険労務士（社労士）向けニュースアプリの編集者です。
以下は$sourceNameが公表した記事の本文抜粋です。この内容にもとづいて、
社労士実務者向けの詳しく分かりやすい概要・実務への影響・重要ポイント・
対象・カテゴリーを作成してください。制度の定義や、事業主が講ずべき
具体的な措置・要件が本文にある場合は、それらを箇条書きで具体的に示して
ください。

タイトル: $title
一覧ページ上の分類: $categoryLabel
本文抜粋:
$bodyText

$_categoryGuide
出力は必ず次のJSON形式のみとし、他の文章やコードブロック記法は含めないでください:
{"summary": "250〜400文字程度の詳しい概要", "practicalImpact": "社労士実務への影響を2〜3文で", "importantPoints": ["具体的な要点1", "要点2", "要点3", "要点4"], "target": "対象となる事業主・従業員等", "category": "NewsCategoryの値（英語名）"}

本文抜粋に書かれていない内容を断定的に書かないでください。
'''
        : '''
あなたは日本の社会保険労務士（社労士）向けニュースアプリの編集者です。
以下は$sourceNameが公表した記事のタイトルです（記事本文は取得していません）。
タイトルと一般的な制度知識をもとに、社労士実務者向けの概要・実務への影響・
重要ポイント・対象・カテゴリーを作成してください。

タイトル: $title
一覧ページ上の分類: $categoryLabel

$_categoryGuide
出力は必ず次のJSON形式のみとし、他の文章やコードブロック記法は含めないでください:
{"summary": "100〜150文字程度の概要", "practicalImpact": "社労士実務への影響を1〜2文で", "importantPoints": ["重要ポイント1", "重要ポイント2"], "target": "対象となる事業主・従業員等", "category": "NewsCategoryの値（英語名）"}

タイトルだけでは内容を断定できない場合は、一般的な制度知識の範囲で推測できる
内容にとどめ、具体的な数値・日付・要件などタイトルに含まれない情報は
断定的に書かないでください。
''';

    final response = await _client
        .post(
          Uri.parse(_endpoint),
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: jsonEncode({
            'model': _model,
            'max_tokens': 1024,
            'messages': [
              {'role': 'user', 'content': prompt},
            ],
          }),
        )
        .timeout(const Duration(seconds: 30));

    if (response.statusCode != 200) {
      throw Exception(
        'Claude APIがHTTP ${response.statusCode}を返しました: ${response.body}',
      );
    }

    final decoded =
        jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    final content = decoded['content'] as List;
    final text = (content.first as Map<String, dynamic>)['text'] as String;
    final json = _extractJson(text);

    return AiSummary(
      summary: json['summary'] as String,
      practicalImpact: json['practicalImpact'] as String,
      importantPoints: (json['importantPoints'] as List)
          .map((e) => e as String)
          .toList(),
      target: json['target'] as String,
      category: json['category'] as String?,
    );
  }

  Map<String, dynamic> _extractJson(String text) {
    final start = text.indexOf('{');
    final end = text.lastIndexOf('}');
    if (start == -1 || end == -1 || end < start) {
      throw FormatException('AI応答からJSONを抽出できませんでした: $text');
    }
    return jsonDecode(text.substring(start, end + 1)) as Map<String, dynamic>;
  }
}
