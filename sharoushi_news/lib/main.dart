import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/constants/app_theme.dart';
import 'core/database/app_database.dart';
import 'features/favorite/favorite_screen.dart';
import 'features/home/home_screen.dart';
import 'features/settings/settings_screen.dart';
import 'repositories/article_repository.dart';
import 'repositories/local_article_repository.dart';
import 'services/news/news_sync_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = await _buildRepository();
  runApp(
    SharoushiNewsApp(
      repository: repository,
      newsSyncService: repository is LocalArticleRepository
          ? NewsSyncService(repository: repository)
          : null,
    ),
  );
}

/// Web向けビルドはローカルDB（sqflite）を使わず、Phase 1〜2同様のインメモリ
/// ダミーデータで動作させる（実機のiOS/Androidではローカルのsqflite DBを使う）。
Future<ArticleRepository> _buildRepository() async {
  if (kIsWeb) return DummyArticleRepository();
  final db = await AppDatabase.open();
  return LocalArticleRepository.create(db);
}

/// アプリのルートウィジェット。
/// [repository] は呼び出し側（main、またはテスト）が用意したものを注入する。
/// [newsSyncService] はローカルDBを使うプラットフォーム（非Web）でのみ渡され、
/// 設定画面の手動データ取得ボタンから使われる（Phase 4、初版・要実機確認）。
class SharoushiNewsApp extends StatefulWidget {
  const SharoushiNewsApp({
    super.key,
    required this.repository,
    this.newsSyncService,
  });

  final ArticleRepository repository;
  final NewsSyncService? newsSyncService;

  @override
  State<SharoushiNewsApp> createState() => _SharoushiNewsAppState();
}

class _SharoushiNewsAppState extends State<SharoushiNewsApp> {
  ThemeMode _themeMode = ThemeMode.system;
  Set<String> _selectedTopicIds = {};

  @override
  void dispose() {
    widget.repository.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '社労士NEWS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: _themeMode,
      locale: const Locale('ja'),
      supportedLocales: const [Locale('ja')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: _RootShell(
        repository: widget.repository,
        newsSyncService: widget.newsSyncService,
        themeMode: _themeMode,
        onThemeModeChanged: (mode) => setState(() => _themeMode = mode),
        selectedTopicIds: _selectedTopicIds,
        onSelectedTopicIdsChanged: (ids) =>
            setState(() => _selectedTopicIds = ids),
      ),
    );
  }
}

class _RootShell extends StatefulWidget {
  const _RootShell({
    required this.repository,
    this.newsSyncService,
    required this.themeMode,
    required this.onThemeModeChanged,
    required this.selectedTopicIds,
    required this.onSelectedTopicIdsChanged,
  });

  final ArticleRepository repository;
  final NewsSyncService? newsSyncService;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;
  final Set<String> selectedTopicIds;
  final ValueChanged<Set<String>> onSelectedTopicIdsChanged;

  @override
  State<_RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<_RootShell> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(
        repository: widget.repository,
        selectedTopicIds: widget.selectedTopicIds,
      ),
      FavoriteScreen(repository: widget.repository),
      SettingsScreen(
        themeMode: widget.themeMode,
        onThemeModeChanged: widget.onThemeModeChanged,
        newsSyncService: widget.newsSyncService,
        selectedTopicIds: widget.selectedTopicIds,
        onSelectedTopicIdsChanged: widget.onSelectedTopicIdsChanged,
      ),
    ];
    return Scaffold(
      body: IndexedStack(index: _tabIndex, children: screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tabIndex,
        onTap: (i) => setState(() => _tabIndex = i),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.newspaper_rounded),
            label: 'ホーム',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.star_rounded),
            label: 'お気に入り',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings_rounded),
            label: '設定',
          ),
        ],
      ),
    );
  }
}
