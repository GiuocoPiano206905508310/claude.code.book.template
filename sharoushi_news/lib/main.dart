import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/constants/app_theme.dart';
import 'core/database/app_database.dart';
import 'features/account/account_form_screen.dart';
import 'features/favorite/favorite_screen.dart';
import 'features/home/home_screen.dart';
import 'features/settings/settings_screen.dart';
import 'repositories/article_repository.dart';
import 'repositories/local_article_repository.dart';
import 'services/auth/account_controller.dart';
import 'services/auth/auth_service.dart';
import 'services/news/news_sync_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = await _buildRepository();
  final accountController = AccountController(
    authService: AuthService(),
    repository: repository,
  );
  // 前回ログインの復元・メールのリンクから戻ってきた場合の処理はここで行う。
  // クラウドとの同期（ネットワーク通信）はアプリの起動を妨げないよう、
  // 裏で進める。
  await accountController.init();
  // GitHub Actions上で1日1回更新される記事一覧を起動時に取得する。
  // 失敗してもアプリの起動は妨げないよう、結果を待たずに実行する。
  unawaited(repository.refreshFromDailyFeed());
  runApp(
    SharoushiNewsApp(
      repository: repository,
      accountController: accountController,
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
/// [accountController] はアカウント状態・おすすめトピック・既読状態の
/// 端末間同期を扱う。
/// [newsSyncService] はローカルDBを使うプラットフォーム（非Web）でのみ渡され、
/// 設定画面の手動データ取得ボタンから使われる（Phase 4、初版・要実機確認）。
class SharoushiNewsApp extends StatefulWidget {
  const SharoushiNewsApp({
    super.key,
    required this.repository,
    required this.accountController,
    this.newsSyncService,
  });

  final ArticleRepository repository;
  final AccountController accountController;
  final NewsSyncService? newsSyncService;

  @override
  State<SharoushiNewsApp> createState() => _SharoushiNewsAppState();
}

class _SharoushiNewsAppState extends State<SharoushiNewsApp> {
  ThemeMode _themeMode = ThemeMode.system;

  @override
  void dispose() {
    widget.accountController.dispose();
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
      home: AnimatedBuilder(
        animation: widget.accountController,
        builder: (context, _) => _RootShell(
          repository: widget.repository,
          accountController: widget.accountController,
          newsSyncService: widget.newsSyncService,
          themeMode: _themeMode,
          onThemeModeChanged: (mode) => setState(() => _themeMode = mode),
        ),
      ),
    );
  }
}

class _RootShell extends StatefulWidget {
  const _RootShell({
    required this.repository,
    required this.accountController,
    this.newsSyncService,
    required this.themeMode,
    required this.onThemeModeChanged,
  });

  final ArticleRepository repository;
  final AccountController accountController;
  final NewsSyncService? newsSyncService;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;

  @override
  State<_RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<_RootShell> {
  int _tabIndex = 0;
  bool _handledPendingRedirect = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _handlePendingRedirect());
  }

  /// Web版でメール（新規登録の確認・パスワード再設定・メールアドレス変更）の
  /// リンクから戻ってきた場合の後処理。アプリ起動につき一度だけ行う。
  Future<void> _handlePendingRedirect() async {
    if (_handledPendingRedirect) return;
    _handledPendingRedirect = true;
    final redirect = widget.accountController.takePendingRedirect();
    if (redirect == null) return;

    if (redirect.error != null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(redirect.error!)));
      return;
    }

    try {
      await redirect.pendingUser;
      await widget.accountController.syncAfterAuthChange();
    } catch (_) {
      // 取得・同期できなくても、ログイン自体はできているのでそのまま使える。
    }
    if (!mounted) return;

    if (redirect.type == 'recovery') {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => AccountFormScreen(
            controller: widget.accountController,
            mode: AccountFormMode.newPassword,
          ),
        ),
      );
    } else if (redirect.type == 'email_change') {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('メールアドレスを変更しました')));
    } else {
      final user = widget.accountController.user;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('登録が完了しました${user != null ? '。ようこそ ${user.username} さん' : ''}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedTopicIds = widget.accountController.selectedTopicIds;
    final screens = [
      HomeScreen(repository: widget.repository, selectedTopicIds: selectedTopicIds),
      FavoriteScreen(repository: widget.repository),
      SettingsScreen(
        themeMode: widget.themeMode,
        onThemeModeChanged: widget.onThemeModeChanged,
        newsSyncService: widget.newsSyncService,
        selectedTopicIds: selectedTopicIds,
        onSelectedTopicIdsChanged: widget.accountController.setSelectedTopicIds,
        accountController: widget.accountController,
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
