import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../theme/game_theme.dart';
import '../widgets/brick_surface.dart';
import 'game_screen.dart';

/// Stage 1-50 grid. Scrollable, grouped visually into the 5 theme bands,
/// with cleared / locked states and a debug "unlock all" switch.
class StageSelectScreen extends StatelessWidget {
  final AppState appState;

  const StageSelectScreen({super.key, required this.appState});

  static const int totalStages = 50;
  static const int columns = 5;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: appState,
      builder: (context, _) {
        final overallTheme =
            appState.themeForStage(appState.highestUnlockedStage);

        return Scaffold(
          body: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: overallTheme.backgroundGradient,
              ),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  _Header(appState: appState, theme: overallTheme),
                  Expanded(
                    child: GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 1,
                      ),
                      itemCount: totalStages,
                      itemBuilder: (context, index) {
                        final stageNumber = index + 1;
                        return _StageTile(
                          stageNumber: stageNumber,
                          unlocked: appState.isStageUnlocked(stageNumber),
                          cleared: appState.isStageCleared(stageNumber),
                          theme: GameThemes.forStage(stageNumber),
                          onTap: appState.isStageUnlocked(stageNumber)
                              ? () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => GameScreen(
                                        appState: appState,
                                        stageNumber: stageNumber,
                                      ),
                                    ),
                                  );
                                }
                              : null,
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  final AppState appState;
  final GameTheme theme;

  const _Header({required this.appState, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: Icon(Icons.arrow_back_rounded, color: theme.primaryText),
          ),
          Expanded(
            child: Text(
              'SELECT STAGE',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
                color: theme.primaryText,
              ),
            ),
          ),
          Row(
            children: [
              Text(
                'DEBUG',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: theme.secondaryText,
                ),
              ),
              Switch(
                value: appState.debugMode,
                activeTrackColor: theme.accentColor,
                onChanged: (_) => appState.toggleDebugMode(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StageTile extends StatelessWidget {
  final int stageNumber;
  final bool unlocked;
  final bool cleared;
  final GameTheme theme;
  final VoidCallback? onTap;

  const _StageTile({
    required this.stageNumber,
    required this.unlocked,
    required this.cleared,
    required this.theme,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final foregroundColor = unlocked ? theme.onAccentColor : const Color(0xFF7A7A7A);

    return Stack(
      fit: StackFit.expand,
      children: [
        // Unlocked stages render as a glossy brick icon in the band's color;
        // locked stages stay flat monochrome gray so the two states read
        // instantly apart at a glance.
        if (unlocked)
          BrickSurface(color: theme.accentColor, borderRadius: 14, borderWidth: 2.5)
        else
          DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xFFB9B9B9).withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onTap,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Text(
                  stageNumber.toString().padLeft(2, '0'),
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: foregroundColor,
                  ),
                ),
                if (cleared)
                  const Positioned(
                    right: 6,
                    top: 6,
                    child: Icon(Icons.star_rounded, size: 14, color: Colors.white),
                  ),
                if (!unlocked)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Icon(
                      Icons.lock_rounded,
                      size: 13,
                      color: foregroundColor.withValues(alpha: 0.8),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
