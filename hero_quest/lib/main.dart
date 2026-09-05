import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'domain/game_controller.dart';
import 'presentation/screens/game_over_screen.dart';
import 'presentation/screens/stage_clear_screen.dart';
import 'presentation/screens/stage_screen.dart';
import 'presentation/screens/title_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 縦画面を基本とする。
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const HeroQuestApp());
}

class HeroQuestApp extends StatelessWidget {
  const HeroQuestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hero Quest',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
      ),
      home: const GameRoot(),
    );
  }
}

/// アプリのルート。`GameController` の状態に応じて表示する画面を
/// 切り替える唯一の場所。
class GameRoot extends StatefulWidget {
  const GameRoot({super.key});

  @override
  State<GameRoot> createState() => _GameRootState();
}

class _GameRootState extends State<GameRoot> {
  late final GameController _controller;

  @override
  void initState() {
    super.initState();
    _controller = GameController();
    _controller.checkForSave();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, _) {
        switch (_controller.status) {
          case GameStatus.title:
            return TitleScreen(controller: _controller);
          case GameStatus.stageClear:
            return StageClearScreen(controller: _controller);
          case GameStatus.gameOver:
            return GameOverScreen(controller: _controller);
          case GameStatus.movable:
          case GameStatus.battle:
          case GameStatus.chestReward:
          case GameStatus.inventoryFull:
          case GameStatus.itemConfirm:
            return StageScreen(controller: _controller);
        }
      },
    );
  }
}
