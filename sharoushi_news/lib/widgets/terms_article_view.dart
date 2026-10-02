import 'package:flutter/material.dart';

import '../core/constants/terms_of_service.dart';

/// 利用規約1条分の表示。[checked]を渡すと、条番号の左にチェックボックスを
/// 表示する（新規登録時の同意用）。
class TermsArticleView extends StatelessWidget {
  const TermsArticleView({
    super.key,
    required this.article,
    this.checked,
    this.onChanged,
  });

  final TermsArticle article;
  final bool? checked;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final checkable = checked != null;
    final heading = Text(
      article.heading,
      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
    );
    final numbered = article.paragraphs.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (checkable)
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onChanged == null ? null : () => onChanged!(!checked!),
            child: Row(
              children: [
                Checkbox(
                  value: checked,
                  onChanged: onChanged == null ? null : (v) => onChanged!(v ?? false),
                  visualDensity: VisualDensity.compact,
                ),
                Expanded(child: heading),
              ],
            ),
          )
        else
          heading,
        const SizedBox(height: 6),
        Padding(
          padding: EdgeInsets.only(left: checkable ? 12 : 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < article.paragraphs.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (numbered)
                        SizedBox(
                          width: 20,
                          child: Text('${i + 1}', style: _bodyStyle(theme)),
                        ),
                      Expanded(
                        child: Text(article.paragraphs[i], style: _bodyStyle(theme)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  TextStyle? _bodyStyle(ThemeData theme) => theme.textTheme.bodySmall?.copyWith(
    color: theme.colorScheme.onSurfaceVariant,
    height: 1.7,
  );
}
