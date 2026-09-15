import 'package:flutter/material.dart';

import 'core/constants/app_theme.dart';
import 'features/favorite/favorite_screen.dart';
import 'features/home/home_screen.dart';
import 'features/settings/settings_screen.dart';
import 'repositories/article_repository.dart';

void main() {
  runApp(const SharoushiNewsApp());
}

/// アプリのルートウィジェット。
/// Phase 1〜2はダミーデータのみで動作し、ネットワークアクセスは行わない。
class SharoushiNewsApp extends StatefulWidget {
  const SharoushiNewsApp({super.key});

  @override
  State<SharoushiNewsApp> createState() => _SharoushiNewsAppState();
}

class _SharoushiNewsAppState extends State<SharoushiNewsApp> {
  final ArticleRepository _repository = DummyArticleRepository();
  ThemeMode _themeMode = ThemeMode.system;

  @override
  void dispose() {
    _repository.dispose();
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
        repository: _repository,
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
