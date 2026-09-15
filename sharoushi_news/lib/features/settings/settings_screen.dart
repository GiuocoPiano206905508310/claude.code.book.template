import 'package:flutter/material.dart';

/// 設定画面（仕様セクション20・21）。
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  static const _disclaimer =
      '本アプリは公的機関が公開する情報を、個人の情報収集を目的として整理する非公式アプリです。\n\n'
      '厚生労働省、日本年金機構、全国健康保険協会その他の公的機関とは関係ありません。\n\n'
      '要約・分類等には自動処理またはAIを利用する場合があります。\n\n'
      '情報の正確性・完全性を保証するものではありません。実務上の判断を行う際は、必ず各公的機関の公式情報・原文を確認してください。';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Text('設定', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 18),
          _SectionCard(
            title: '外観',
            child: Column(
              children: [
                _ThemeOptionTile(
                  label: '端末の設定に合わせる',
                  selected: themeMode == ThemeMode.system,
                  onTap: () => onThemeModeChanged(ThemeMode.system),
                ),
                _ThemeOptionTile(
                  label: 'ライト',
                  selected: themeMode == ThemeMode.light,
                  onTap: () => onThemeModeChanged(ThemeMode.light),
                ),
                _ThemeOptionTile(
                  label: 'ダーク',
                  selected: themeMode == ThemeMode.dark,
                  onTap: () => onThemeModeChanged(ThemeMode.dark),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'このアプリについて',
            child: Text(_disclaimer, style: theme.textTheme.bodySmall?.copyWith(height: 1.8, color: theme.colorScheme.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: theme.colorScheme.primary),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _ThemeOptionTile extends StatelessWidget {
  const _ThemeOptionTile({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
            if (selected) Icon(Icons.check_rounded, color: theme.colorScheme.primary, size: 20),
          ],
        ),
      ),
    );
  }
}
