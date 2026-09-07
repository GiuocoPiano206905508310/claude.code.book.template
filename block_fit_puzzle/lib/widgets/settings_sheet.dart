import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../theme/game_theme.dart';

/// The app settings sheet: currently just the dark/white background switch.
/// Shared by every screen that exposes a settings (⚙️) button so there is
/// only one place defining what "settings" means.
void showSettingsSheet(BuildContext context, AppState appState, GameTheme theme) {
  showModalBottomSheet(
    context: context,
    backgroundColor: theme.boardBackground,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) => AnimatedBuilder(
      animation: appState,
      builder: (context, _) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '設定',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: theme.primaryText,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                '背景',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: theme.secondaryText,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _BackgroundOption(
                      label: 'ホワイト',
                      icon: Icons.light_mode_rounded,
                      selected: !appState.isDarkMode,
                      onTap: () => appState.setBackgroundMode(BackgroundMode.light),
                      theme: theme,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _BackgroundOption(
                      label: 'ダーク',
                      icon: Icons.dark_mode_rounded,
                      selected: appState.isDarkMode,
                      onTap: () => appState.setBackgroundMode(BackgroundMode.dark),
                      theme: theme,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
}

class _BackgroundOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final GameTheme theme;

  const _BackgroundOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected ? theme.accentColor : theme.cellEmpty,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? theme.accentColor : theme.boardBorder,
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? theme.onAccentColor : theme.secondaryText),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: selected ? theme.onAccentColor : theme.secondaryText,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
