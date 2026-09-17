import 'dart:convert';

import 'package:http/http.dart' as http;

/// GitHub Actions上での日次フィード生成時に、タイトルのみから概要・実務影響・
/// 重要ポイント・対象をAI（Claude API）で生成するためのサービス。
///
/// 記事本文までは取得していないため、生成される内容は「タイトルと一般的な
/// 制度知識からの推測」であり、a1〜a15の手動キュレーション記事と同程度の
/// 精度の限界を持つ。RSSは使用しない方針とは無関係（AI要約は取得後の
/// 後処理であり、取得方法そのものではない）。
class AiSummary {
  const AiSummary({
    required this.summary,
    required this.practicalImpact,
    required this.importantPoints,
    required this.target,
  });

  final String summary;
  final String practicalImpact;
  final List<String> importantPoints;
  final String target;
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

  Future<AiSummary> summarize({
    required String title,
    required String sourceName,
    required String categoryLabel,
  }) async {
    final prompt =
        '''
あなたは日本の社会保険労務士（社労士）向けニュースアプリの編集者です。
以下は$sourceNameが公表した記事のタイトルです（記事本文は取得していません）。
タイトルと一般的な制度知識をもとに、社労士実務者向けの概要・実務への影響・
重要ポイント・対象を作成してください。

タイトル: $title
カテゴリー: $categoryLabel

出力は必ず次のJSON形式のみとし、他の文章やコードブロック記法は含めないでください:
{"summary": "100〜150文字程度の概要", "practicalImpact": "社労士実務への影響を1〜2文で", "importantPoints": ["重要ポイント1", "重要ポイント2"], "target": "対象となる事業主・従業員等"}

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
