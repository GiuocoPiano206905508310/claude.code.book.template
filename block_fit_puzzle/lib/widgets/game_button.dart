import 'package:flutter/material.dart';

/// A circular, theme-tinted icon button used for the top utility row
/// (help / hint / reset) and the rotate control.
///
/// The icon itself always stays monochrome (per design spec) — only the
/// button background is tinted with the current stage theme's accent color.
class GameButton extends StatelessWidget {
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;
  final VoidCallback? onTap;
  final double size;
  final String? semanticLabel;

  const GameButton({
    super.key,
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
    this.onTap,
    this.size = 48,
    this.semanticLabel,
  });

  bool get _enabled => onTap != null;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: _enabled ? backgroundColor : backgroundColor.withValues(alpha: 0.35),
        shape: const CircleBorder(),
        elevation: _enabled ? 2 : 0,
        shadowColor: Colors.black26,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(
              icon,
              color: _enabled ? iconColor : iconColor.withValues(alpha: 0.6),
              size: size * 0.5,
            ),
          ),
        ),
      ),
    );
  }
}
