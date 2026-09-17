import 'package:flutter/material.dart';

import '../../core/constants/app_categories.dart';
import '../../core/constants/recommended_topics.dart';
import '../../models/article.dart';
import '../../repositories/article_repository.dart';
import '../../widgets/category_chip.dart';
import '../../widgets/news_card.dart';
import '../article/article_detail_screen.dart';
import '../search/search_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.repository,
    required this.selectedTopicIds,
  });

  final ArticleRepository repository;
  final Set<String> selectedTopicIds;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

enum _SortOrder { newest, oldest, importance }

extension on _SortOrder {
  String get label {
    switch (this) {
      case _SortOrder.newest:
        return '新しい順';
      case _SortOrder.oldest:
        return '古い順';
      case _SortOrder.importance:
        return '重要度順';
    }
  }
}

class _HomeScreenState extends State<HomeScreen> {
  HomeFilterOption _filter = const HomeFilterOption.all();
  _SortOrder _sortOrder = _SortOrder.newest;
  bool _unreadOnly = false;
  bool _favoritesOnly = false;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text(
              '社労士NEWS',
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: _SearchEntryField(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SearchScreen(repository: widget.repository),
                ),
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              scrollDirection: Axis.horizontal,
              itemCount: homeFilterOptions.length,
              itemBuilder: (context, index) {
                final option = homeFilterOptions[index];
                return CategoryChip(
                  label: option.label,
                  selected:
                      identical(option, _filter) ||
                      option.label == _filter.label,
                  onTap: () => setState(() => _filter = option),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                CategoryChip(
                  label: '未読のみ',
                  selected: _unreadOnly,
                  onTap: () => setState(() => _unreadOnly = !_unreadOnly),
                ),
                CategoryChip(
                  label: 'お気に入りのみ',
                  selected: _favoritesOnly,
                  onTap: () =>
                      setState(() => _favoritesOnly = !_favoritesOnly),
                ),
                const Spacer(),
                PopupMenuButton<_SortOrder>(
                  initialValue: _sortOrder,
                  onSelected: (order) => setState(() => _sortOrder = order),
                  itemBuilder: (context) => _SortOrder.values
                      .map(
                        (order) => PopupMenuItem(
                          value: order,
                          child: Text(order.label),
                        ),
                      )
                      .toList(),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.sort_rounded,
                        size: 18,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _sortOrder.label,
                        style: Theme.of(context).textTheme.bodySmall
                            ?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: ListenableBuilder(
              listenable: widget.repository,
              builder: (context, _) {
                final isRecommended =
                    _filter.kind == HomeFilterKind.recommended;
                final items =
                    widget.repository.articles
                        .where(
                          isRecommended
                              ? (a) => articleMatchesSelectedTopics(
                                  a,
                                  widget.selectedTopicIds,
                                )
                              : _filter.matches,
                        )
                        .where((a) => !_unreadOnly || !a.isRead)
                        .where((a) => !_favoritesOnly || a.isFavorite)
                        .toList()
                      ..sort(_sortComparator);
                if (items.isEmpty) {
                  final message =
                      isRecommended && widget.selectedTopicIds.isEmpty
                      ? '設定画面の「おすすめトピック」でチェックした項目に関連するニュースがここに表示されます。'
                      : '該当するニュースがありません。';
                  return _EmptyState(message: message);
                }
                return RefreshIndicator(
                  onRefresh: widget.repository.refreshFromDailyFeed,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final article = items[index];
                      return NewsCard(
                        article: article,
                        onTap: () => _openDetail(context, article),
                        onToggleFavorite: () =>
                            widget.repository.toggleFavorite(article.id),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  int _sortComparator(Article a, Article b) {
    switch (_sortOrder) {
      case _SortOrder.newest:
        return b.publishedAt.compareTo(a.publishedAt);
      case _SortOrder.oldest:
        return a.publishedAt.compareTo(b.publishedAt);
      case _SortOrder.importance:
        final byImportance = b.importance.compareTo(a.importance);
        return byImportance != 0
            ? byImportance
            : b.publishedAt.compareTo(a.publishedAt);
    }
  }

  void _openDetail(BuildContext context, Article article) {
    widget.repository.markAsRead(article.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ArticleDetailScreen(
          repository: widget.repository,
          articleId: article.id,
        ),
      ),
    );
  }
}

class _SearchEntryField extends StatelessWidget {
  const _SearchEntryField({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.cardTheme.color,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.dividerColor),
          ),
          child: Row(
            children: [
              Icon(
                Icons.search_rounded,
                size: 20,
                color: theme.colorScheme.outline,
              ),
              const SizedBox(width: 8),
              Text(
                'キーワードで検索',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: Theme.of(context).colorScheme.outline),
        ),
      ),
    );
  }
}
