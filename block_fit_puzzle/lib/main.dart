import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'controllers/game_controller.dart';
import 'screens/title_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const BlockFitPuzzleApp());
}

/// Root widget. Phase 1 scope: title -> stage select -> game screen
/// navigation with no persistence or gameplay logic yet.
class BlockFitPuzzleApp extends StatefulWidget {
  const BlockFitPuzzleApp({super.key});

  @override
  State<BlockFitPuzzleApp> createState() => _BlockFitPuzzleAppState();
}

class _BlockFitPuzzleAppState extends State<BlockFitPuzzleApp> {
  final AppState _appState = AppState();

  @override
  void dispose() {
    _appState.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Block Fit Puzzle',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: TitleScreen(appState: _appState),
    );
  }
}
