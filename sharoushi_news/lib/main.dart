import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'core/constants/app_theme.dart';
import 'core/database/app_database.dart';
import 'features/favorite/favorite_screen.dart';
import 'features/home/home_screen.dart';
import 'features/settings/settings_screen.dart';
import 'repositories/article_repository.dart';
import 'repositories/local_article_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(SharoushiNewsApp(repository: await _buildRepository()));
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
class SharoushiNewsApp extends StatefulWidget {
  const SharoushiNewsApp({super.key, required this.repository});

  final ArticleRepository repository;

  @override
  State<SharoushiNewsApp> createState() => _SharoushiNewsAppState();
}

class _SharoushiNewsAppState extends State<SharoushiNewsApp> {
  ThemeMode _themeMode = ThemeMode.system;

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
      home: _RootShell(
        repository: widget.repository,
        themeMode: _themeMode,
        onThemeModeChanged: (mode) => setState(() => _themeMode = mode),
      ),
    );
  }
}

class _RootShell extends StatefulWidget {
  const _RootShell({
    required this.repository,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final ArticleRepository repository;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  @override
  State<_RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<_RootShell> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(repository: widget.repository),
      FavoriteScreen(repository: widget.repository),
      SettingsScreen(themeMode: widget.themeMode, onThemeModeChanged: widget.onThemeModeChanged),
    ];
    return Scaffold(
      body: IndexedStack(index: _tabIndex, children: screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tabIndex,
        onTap: (i) => setState(() => _tabIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.newspaper_rounded), label: 'ホーム'),
          BottomNavigationBarItem(icon: Icon(Icons.star_rounded), label: 'お気に入り'),
          BottomNavigationBarItem(icon: Icon(Icons.settings_rounded), label: '設定'),
        ],
      ),
    );
  }
}
