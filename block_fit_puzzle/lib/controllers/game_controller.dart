import 'package:flutter/foundation.dart';

import '../theme/game_theme.dart';

/// App-level state for the Phase 1 preview: stage progress/unlock bookkeeping
/// and a debug theme override switch.
///
/// This intentionally holds no puzzle logic (no placement, collision, or
/// clear detection) — that lands in Phase 2/3 alongside real persistence
/// via services/save_service.dart. For now progress is in-memory only, just
/// enough to preview the title/stage-select screens.
class AppState extends ChangeNotifier {
  bool _debugMode = false;

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

  GameTheme themeForStage(int stageNumber) =>
      previewThemeOverride ?? GameThemes.forStage(stageNumber);
}
