import 'package:flutter/material.dart';

import '../../core/constants/recommended_topics.dart';
import '../../services/news/news_sync_service.dart';

/// 設定画面（仕様セクション20・21）。
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.themeMode,
    required this.onThemeModeChanged,
    required this.selectedTopicIds,
    required this.onSelectedTopicIdsChanged,
    this.newsSyncService,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;
  final Set<String> selectedTopicIds;
  final ValueChanged<Set<String>> onSelectedTopicIdsChanged;

  /// Web版では常にnull（ローカルDBを使わないため）。
  final NewsSyncService? newsSyncService;

  static const _disclaimer =
      '本アプリは公的機関が公開する情報を、個人の情報収集を目的として整理する非公式アプリです。\n\n'
      '厚生労働省、日本年金機構、全国健康保険協会その他の公的機関とは関係ありません。\n\n'
      '要約・分類等には自動処理またはAIを利用する場合があります。\n\n'
      '情報の正確性・完全性を保証するものではありません。実務上の判断を行う際は、必ず各公的機関の公式情報・原文を確認してください。';

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _syncing = false;
  String? _lastResultMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Text(
            '設定',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 18),
          _SectionCard(
            title: '外観',
            child: Column(
              children: [
                _ThemeOptionTile(
                  label: '端末の設定に合わせる',
                  selected: widget.themeMode == ThemeMode.system,
                  onTap: () => widget.onThemeModeChanged(ThemeMode.system),
                ),
                _ThemeOptionTile(
                  label: 'ライト',
                  selected: widget.themeMode == ThemeMode.light,
                  onTap: () => widget.onThemeModeChanged(ThemeMode.light),
                ),
                _ThemeOptionTile(
                  label: 'ダーク',
                  selected: widget.themeMode == ThemeMode.dark,
                  onTap: () => widget.onThemeModeChanged(ThemeMode.dark),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'おすすめトピック',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'チェックしたトピックに関連するニュースが、ホーム画面の「おすすめ」タブに表示されます。',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: 4),
                for (final topic in recommendedTopics)
                  _TopicCheckboxTile(
                    label: topic.label,
                    checked: widget.selectedTopicIds.contains(topic.id),
                    onChanged: (checked) {
                      final updated = Set<String>.from(widget.selectedTopicIds);
                      if (checked) {
                        updated.add(topic.id);
                      } else {
                        updated.remove(topic.id);
                      }
                      widget.onSelectedTopicIdsChanged(updated);
                    },
                  ),
              ],
            ),
          ),
          if (widget.newsSyncService != null) ...[
            const SizedBox(height: 16),
            _SectionCard(
              title: 'データ取得（試験運用）',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '厚生労働省サイトから最新情報を取得します。まだ試験段階の機能のため、'
                    'タイトルと原文リンクのみを取得し、概要等はAI要約が未実装のためプレースホルダー表示になります。',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _syncing ? null : _runSync,
                      icon: _syncing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.sync_rounded, size: 18),
                      label: Text(_syncing ? '取得中…' : '厚生労働省の最新情報を取得'),
                    ),
                  ),
                  if (_lastResultMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _lastResultMessage!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          _SectionCard(
            title: 'このアプリについて',
            child: Text(
              SettingsScreen._disclaimer,
              style: theme.textTheme.bodySmall?.copyWith(
                height: 1.8,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _runSync() async {
    final service = widget.newsSyncService;
    if (service == null) return;
    setState(() {
      _syncing = true;
      _lastResultMessage = null;
    });
    try {
      final result = await service.syncMhlw();
      if (!mounted) return;
      setState(() {
        _lastResultMessage = result.hasErrors
            ? '${result.fetchedCount}件取得（うち新規${result.newCount}件）。一部のページ取得に失敗しました（${result.errors.length}件）。'
            : '${result.fetchedCount}件取得しました（うち新規${result.newCount}件）。';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _lastResultMessage = '取得に失敗しました: $e');
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
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
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _TopicCheckboxTile extends StatelessWidget {
  const _TopicCheckboxTile({
    required this.label,
    required this.checked,
    required this.onChanged,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => onChanged(!checked),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Checkbox(
              value: checked,
              onChanged: (v) => onChanged(v ?? false),
              visualDensity: VisualDensity.compact,
            ),
            Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
          ],
        ),
      ),
    );
  }
}

class _ThemeOptionTile extends StatelessWidget {
  const _ThemeOptionTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

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
            if (selected)
              Icon(
                Icons.check_rounded,
                color: theme.colorScheme.primary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}
