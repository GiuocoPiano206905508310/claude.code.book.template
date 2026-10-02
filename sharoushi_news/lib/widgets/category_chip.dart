import 'package:flutter/material.dart';

/// ホーム画面上部のカテゴリー横スクロールで使う選択チップ。
class CategoryChip extends StatelessWidget {
  const CategoryChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  static const double height = 36;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: selected ? scheme.primary : Theme.of(context).cardColor,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? scheme.primary : Theme.of(context).dividerColor,
          ),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.center,
            child: Text(
              label,
              softWrap: false,
              textAlign: TextAlign.center,
              // 日本語フォントはアセント・ディセントが非対称なため、行間を
              // 上下均等に割り振って視覚的に中央へ揃える。
              textHeightBehavior: const TextHeightBehavior(
                leadingDistribution: TextLeadingDistribution.even,
              ),
              style: TextStyle(
                fontSize: 13,
                height: 1.2,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : scheme.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
