import '../../models/article.dart';

/// ホーム画面のカテゴリー横スクロール（仕様セクション10）用の選択肢。
/// 「すべて」「重要」は NewsCategory ではなく、絞り込みの特殊条件として扱う。
enum HomeFilterKind { all, important, category }

class HomeFilterOption {
  const HomeFilterOption.all()
      : kind = HomeFilterKind.all,
        category = null;

  const HomeFilterOption.important()
      : kind = HomeFilterKind.important,
        category = null;

  const HomeFilterOption.category(NewsCategory c)
      : kind = HomeFilterKind.category,
        category = c;

  final HomeFilterKind kind;
  final NewsCategory? category;

  String get label {
    switch (kind) {
      case HomeFilterKind.all:
        return 'すべて';
      case HomeFilterKind.important:
        return '重要';
      case HomeFilterKind.category:
        return category!.label;
    }
  }

  bool matches(Article article) {
    switch (kind) {
      case HomeFilterKind.all:
        return true;
      case HomeFilterKind.important:
        return article.importance == 3;
      case HomeFilterKind.category:
        return article.category == category;
    }
  }
}

const List<HomeFilterOption> homeFilterOptions = [
  HomeFilterOption.all(),
  HomeFilterOption.important(),
  HomeFilterOption.category(NewsCategory.lawChange),
  HomeFilterOption.category(NewsCategory.labor),
  HomeFilterOption.category(NewsCategory.socialInsurance),
  HomeFilterOption.category(NewsCategory.employmentInsurance),
  HomeFilterOption.category(NewsCategory.subsidy),
  HomeFilterOption.category(NewsCategory.pension),
];
