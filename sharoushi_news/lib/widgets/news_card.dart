import 'package:flutter/material.dart';

import '../core/utils/date_formatter.dart';
import '../models/article.dart';
import 'importance_badge.dart';

/// ホーム／検索／お気に入り画面で共通して使うニュースカード（仕様セクション10）。
class NewsCard extends StatelessWidget {
  const NewsCard({
    super.key,
    required this.article,
    required this.onTap,
    required this.onToggleFavorite,
  });

  final Article article;
  final VoidCallback onTap;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ImportanceBadge(importance: article.importance, dense: true),
                  if (!article.isRead) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                  const Spacer(),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      article.isFavorite ? Icons.star_rounded : Icons.star_border_rounded,
                      color: article.isFavorite ? const Color(0xFFC79A2B) : theme.colorScheme.outline,
                    ),
                    onPressed: onToggleFavorite,
                    tooltip: article.isFavorite ? 'お気に入り解除' : 'お気に入りに追加',
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                article.title,
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.4),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Text(
                article.summary,
                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.5),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    formatArticleDate(article.publishedAt),
                    style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(width: 8),
                  Text('・', style: TextStyle(color: theme.colorScheme.outline)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      article.sourceName,
                      style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.outline),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '詳細を見る',
                    style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary, fontWeight: FontWeight.w700),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: theme.colorScheme.primary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
