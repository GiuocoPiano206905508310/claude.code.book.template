import 'package:flutter/material.dart';

import '../../models/article.dart';
import '../../repositories/article_repository.dart';
import '../../widgets/news_card.dart';
import '../article/article_detail_screen.dart';

/// 検索画面（仕様セクション15）。タイトル・要約・カテゴリー・情報源を対象に検索する。
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.repository});

  final ArticleRepository repository;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<Article> _search(List<Article> all) {
    final q = _query.trim();
    if (q.isEmpty) return const [];
    return all.where((a) {
      final haystack =
          '${a.title} ${a.summary} ${a.category.label} ${a.sourceName}';
      return haystack.contains(q);
    }).toList()..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: '育児休業、最低賃金 など',
            border: InputBorder.none,
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
      ),
      body: ListenableBuilder(
        listenable: widget.repository,
        builder: (context, _) {
          if (_query.trim().isEmpty) {
            return const _Hint();
          }
          final results = _search(widget.repository.articles);
          if (results.isEmpty) {
            return const Center(child: Text('該当するニュースが見つかりませんでした。'));
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: results.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final article = results[index];
              return NewsCard(
                article: article,
                onTap: () {
                  widget.repository.markAsRead(article.id);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ArticleDetailScreen(
                        repository: widget.repository,
                        articleId: article.id,
                      ),
                    ),
                  );
                },
                onToggleFavorite: () =>
                    widget.repository.toggleFavorite(article.id),
              );
            },
          );
        },
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint();

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(color: Theme.of(context).colorScheme.outline);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_rounded,
              size: 36,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 12),
            Text(
              'タイトル・要約・カテゴリー・情報源から検索できます。',
              textAlign: TextAlign.center,
              style: style,
            ),
          ],
        ),
      ),
    );
  }
}
