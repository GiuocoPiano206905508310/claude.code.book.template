import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/utils/date_formatter.dart';
import '../../models/article.dart';
import '../../repositories/article_repository.dart';
import '../../widgets/importance_badge.dart';

/// ニュース詳細画面（仕様セクション11）。
class ArticleDetailScreen extends StatelessWidget {
  const ArticleDetailScreen({super.key, required this.repository, required this.articleId});

  final ArticleRepository repository;
  final String articleId;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: repository,
      builder: (context, _) {
        final article = repository.articles.where((a) => a.id == articleId).firstOrNull;
        if (article == null) {
          return const Scaffold(body: Center(child: Text('この記事は見つかりませんでした。')));
        }
        return _DetailBody(
          article: article,
          onToggleFavorite: () => repository.toggleFavorite(article.id),
        );
      },
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.article, required this.onToggleFavorite});

  final Article article;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(article.category.label),
        actions: [
          IconButton(
            icon: Icon(
              article.isFavorite ? Icons.star_rounded : Icons.star_border_rounded,
              color: article.isFavorite ? const Color(0xFFC79A2B) : null,
            ),
            onPressed: onToggleFavorite,
            tooltip: article.isFavorite ? 'お気に入り解除' : 'お気に入りに追加',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        child: SelectionArea(
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              article.title,
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, height: 1.4),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ImportanceBadge(importance: article.importance),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${article.sourceName} ・ ${formatYmd(article.publishedAt)}公表',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                  ),
                ),
              ],
            ),
            const Divider(height: 32),
            const _SectionLabel('概要'),
            Text(article.summary, style: theme.textTheme.bodyMedium?.copyWith(height: 1.7)),
            const SizedBox(height: 22),
            const _SectionLabel('社労士実務への影響'),
            Text(article.practicalImpact, style: theme.textTheme.bodyMedium?.copyWith(height: 1.7)),
            const SizedBox(height: 22),
            const _SectionLabel('重要ポイント'),
            ...article.importantPoints.map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 7),
                      child: Container(width: 5, height: 5, decoration: BoxDecoration(color: theme.colorScheme.primary, shape: BoxShape.circle)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(p, style: theme.textTheme.bodyMedium?.copyWith(height: 1.6))),
                  ],
                ),
              ),
            ),
            if (article.deadline != null) ...[
              const SizedBox(height: 22),
              const _SectionLabel('対応期限'),
              Text(article.deadline!, style: theme.textTheme.bodyMedium?.copyWith(height: 1.7)),
            ],
            const SizedBox(height: 22),
            const _SectionLabel('対象'),
            Text(article.target, style: theme.textTheme.bodyMedium?.copyWith(height: 1.7)),
            const SizedBox(height: 22),
            const _SectionLabel('出典'),
            Text(article.sourceName, style: theme.textTheme.bodyMedium?.copyWith(height: 1.7)),
            const SizedBox(height: 28),
            if (article.isAiGenerated)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'この内容は公式情報をもとにAIで要約・整理したものです。正確な内容については必ず公式サイトの原文をご確認ください。',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.6),
                ),
              ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _openSource(context),
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('公式サイトで原文を見る'),
              ),
            ),
          ],
          ),
        ),
      ),
    );
  }

  Future<void> _openSource(BuildContext context) async {
    final uri = Uri.tryParse(article.canonicalUrl);
    if (uri == null) return;
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('リンクを開けませんでした。')),
      );
    }
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: Theme.of(context).colorScheme.primary,
              letterSpacing: 0.3,
            ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
