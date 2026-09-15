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

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        labelStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : scheme.onSurfaceVariant,
        ),
        backgroundColor: Theme.of(context).cardColor,
        selectedColor: scheme.primary,
        side: BorderSide(color: selected ? scheme.primary : Theme.of(context).dividerColor),
        shape: const StadiumBorder(),
      ),
    );
  }
}
