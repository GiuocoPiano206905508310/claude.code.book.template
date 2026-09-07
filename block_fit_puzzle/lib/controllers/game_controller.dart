import 'package:flutter/material.dart';

import '../theme/game_theme.dart';

/// The app-wide "background" setting from the settings sheet: independent
/// of the per-stage-band theme, it swaps the neutral chrome (page
/// background, board/tray surfaces, text color) to either a light or dark
/// look while keeping each band's own accent/brick colors untouched.
enum BackgroundMode { light, dark }

/// App-level state for the Phase 1 preview: stage progress/unlock bookkeeping
/// and a debug theme override switch.
///
/// This intentionally holds no puzzle logic (no placement, collision, or
/// clear detection) — that lands in Phase 2/3 alongside real persistence
/// via services/save_service.dart. For now progress is in-memory only, just
/// enough to preview the title/stage-select screens.
class AppState extends ChangeNotifier {
  bool _debugMode = false;
  BackgroundMode _backgroundMode = BackgroundMode.light;

  /// Dummy cleared-stage set so the stage select preview can show
  /// checkmarks and an unlocked "next" stage.
  final Set<int> _clearedStages = {1, 2, 3};

  /// When set, overrides the theme every screen uses regardless of stage,
  /// for the Phase 1 "switch between theme bands" preview mode.
  GameTheme? previewThemeOverride;

  bool get debugMode => _debugMode;

  Set<int> get clearedStages => Set.unmodifiable(_clearedStages);

  int get highestUnlockedStage {
    if (_debugMode) return 50;
    if (_clearedStages.isEmpty) return 1;
    final maxCleared = _clearedStages.reduce((a, b) => a > b ? a : b);
    return (maxCleared + 1).clamp(1, 50);
  }

  bool isStageUnlocked(int stageNumber) =>
      _debugMode || stageNumber <= highestUnlockedStage;

  bool isStageCleared(int stageNumber) => _clearedStages.contains(stageNumber);

  void toggleDebugMode() {
    _debugMode = !_debugMode;
    notifyListeners();
  }

  void setPreviewTheme(GameTheme? theme) {
    previewThemeOverride = theme;
    notifyListeners();
  }

  BackgroundMode get backgroundMode => _backgroundMode;

  bool get isDarkMode => _backgroundMode == BackgroundMode.dark;

  void setBackgroundMode(BackgroundMode mode) {
    _backgroundMode = mode;
    notifyListeners();
  }

  GameTheme themeForStage(int stageNumber) =>
      previewThemeOverride ?? GameThemes.forStage(stageNumber);

  /// The theme a screen should actually render with: the stage's band (or
  /// preview override) colors for accents/pieces, with the neutral chrome
  /// swapped to the current dark/white background setting.
  GameTheme effectiveTheme(int stageNumber) {
    final base = themeForStage(stageNumber);
    return isDarkMode
        ? base.copyWith(
            backgroundGradient: const [Color(0xFF15151A), Color(0xFF1F1F26)],
            boardBackground: const Color(0xFF23232B),
            boardBorder: const Color(0xFF3A3A45),
            cellEmpty: const Color(0xFF2C2C36),
            trayBackground: const Color(0xFF1B1B22),
            primaryText: const Color(0xFFF2F2F2),
            secondaryText: const Color(0xFFB0B0B8),
          )
        : base.copyWith(
            backgroundGradient: const [Color(0xFFFFFFFF), Color(0xFFF2F2F2)],
            boardBackground: Colors.white,
            boardBorder: const Color(0xFFE0E0E0),
            cellEmpty: const Color(0xFFF0F0F0),
            trayBackground: const Color(0xFFF7F7F7),
            primaryText: const Color(0xFF222222),
            secondaryText: const Color(0xFF757575),
          );
  }
}
