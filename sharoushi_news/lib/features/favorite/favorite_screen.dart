import 'package:flutter/material.dart';

import '../../repositories/article_repository.dart';
import '../../widgets/news_card.dart';
import '../article/article_detail_screen.dart';

/// お気に入り一覧画面（仕様セクション12）。
class FavoriteScreen extends StatelessWidget {
  const FavoriteScreen({super.key, required this.repository});

  final ArticleRepository repository;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Text(
              'お気に入り',
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          Expanded(
            child: ListenableBuilder(
              listenable: repository,
              builder: (context, _) {
                final items =
                    repository.articles.where((a) => a.isFavorite).toList()
                      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
                if (items.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.star_border_rounded,
                            size: 36,
                            color: Theme.of(context).colorScheme.outline,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'お気に入りに登録したニュースはまだありません。\nカード右上の☆をタップすると、ここに表示されます。',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.outline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final article = items[index];
                    return NewsCard(
                      article: article,
                      onTap: () {
                        repository.markAsRead(article.id);
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ArticleDetailScreen(
                              repository: repository,
                              articleId: article.id,
                            ),
                          ),
                        );
                      },
                      onToggleFavorite: () =>
                          repository.toggleFavorite(article.id),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
