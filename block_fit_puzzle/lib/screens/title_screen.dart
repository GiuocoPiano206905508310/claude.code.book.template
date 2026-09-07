import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../widgets/settings_sheet.dart';
import 'stage_select_screen.dart';

/// App entry screen: title, PLAY button, and current progress.
class TitleScreen extends StatelessWidget {
  final AppState appState;

  const TitleScreen({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: appState,
      builder: (context, _) {
        final theme = appState.effectiveTheme(appState.highestUnlockedStage);

        return Scaffold(
          body: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: theme.backgroundGradient,
              ),
            ),
            child: SafeArea(
              child: Stack(
                children: [
                  Align(
                    alignment: Alignment.topRight,
                    child: IconButton(
                      onPressed: () =>
                          showSettingsSheet(context, appState, theme),
                      icon: Icon(
                        Icons.settings_rounded,
                        color: theme.secondaryText,
                      ),
                    ),
                  ),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              theme.decorationIcon,
                              size: 56,
                              color: theme.accentColor,
                            ),
                            const SizedBox(height: 18),
                            Text(
                              'BLOCK FIT',
                              style: TextStyle(
                                fontSize: 40,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 2,
                                color: theme.primaryText,
                              ),
                            ),
                            Text(
                              'PUZZLE',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w500,
                                letterSpacing: 8,
                                color: theme.secondaryText,
                              ),
                            ),
                            const SizedBox(height: 56),
                            SizedBox(
                              width: double.infinity,
                              height: 58,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: theme.accentColor,
                                  foregroundColor: theme.onAccentColor,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(28),
                                  ),
                                  elevation: 3,
                                ),
                                onPressed: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          StageSelectScreen(appState: appState),
                                    ),
                                  );
                                },
                                child: const Text(
                                  'PLAY',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 3,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'Stage ${appState.highestUnlockedStage} / 50',
                              style: TextStyle(
                                fontSize: 15,
                                color: theme.secondaryText,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
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
