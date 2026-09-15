import 'package:flutter/material.dart';

import '../core/constants/app_theme.dart';

/// 重要度（仕様セクション14）を表すバッジ。
/// importance3: 必ず確認 / importance2: 重要 / importance1: 参考
class ImportanceBadge extends StatelessWidget {
  const ImportanceBadge({super.key, required this.importance, this.dense = false});

  final int importance;
  final bool dense;

  static const _labels = {3: '必ず確認', 2: '重要', 1: '参考'};

  Color _fg(BuildContext context) {
    switch (importance) {
      case 3:
        return AppColors.importance3;
      case 2:
        return AppColors.importance2;
      default:
        return AppColors.importance1;
    }
  }

  Color _bg(BuildContext context) {
    switch (importance) {
      case 3:
        return AppColors.importance3Bg;
      case 2:
        return AppColors.importance2Bg;
      default:
        return AppColors.importance1Bg;
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = _labels[importance] ?? '参考';
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 7 : 9, vertical: dense ? 2 : 4),
      decoration: BoxDecoration(
        color: _bg(context),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _fg(context),
          fontSize: dense ? 11 : 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
