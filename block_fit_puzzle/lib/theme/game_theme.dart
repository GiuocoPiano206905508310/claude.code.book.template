import 'package:flutter/material.dart';

/// Visual theme applied to a range of 10 stages.
///
/// Everything a screen needs to re-skin itself for a stage band lives here:
/// background gradient, board/tray surfaces, accent (button/brick) color, and
/// the muted color palette used to paint puzzle pieces. Piece colors are kept
/// deliberately higher-contrast than the background so blocks never blend
/// into the theme.
class GameTheme {
  final String id;
  final String displayName;
  final List<Color> backgroundGradient;
  final Color boardBackground;
  final Color boardBorder;
  final Color cellEmpty;
  final Color trayBackground;
  final Color accentColor;
  final Color onAccentColor;
  final Color primaryText;
  final Color secondaryText;
  final IconData decorationIcon;
  final List<Color> pieceColors;

  const GameTheme({
    required this.id,
    required this.displayName,
    required this.backgroundGradient,
    required this.boardBackground,
    required this.boardBorder,
    required this.cellEmpty,
    required this.trayBackground,
    required this.accentColor,
    required this.onAccentColor,
    required this.primaryText,
    required this.secondaryText,
    required this.decorationIcon,
    required this.pieceColors,
  });
}

/// The 5 stage-band themes, plus lookup helpers.
///
/// Band accent colors follow the requested progression: cream -> yellow ->
/// orange -> brown -> purple, brightest/lightest early and richer/darker as
/// stages advance.
class GameThemes {
  GameThemes._();

  static const cream = GameTheme(
    id: 'cream',
    displayName: 'Cream',
    backgroundGradient: [Color(0xFFFBF4E8), Color(0xFFF3E5CB)],
    boardBackground: Color(0xFFFFFFFF),
    boardBorder: Color(0xFFE7D2AC),
    cellEmpty: Color(0xFFF6ECDA),
    trayBackground: Color(0xFFFAF3E5),
    accentColor: Color(0xFFD9B98D),
    onAccentColor: Color(0xFF5B4530),
    primaryText: Color(0xFF4A3A28),
    secondaryText: Color(0xFF9C8768),
    decorationIcon: Icons.extension_rounded,
    pieceColors: [
      Color(0xFF4C9B7C),
      Color(0xFF5FA8D3),
      Color(0xFFE0B24A),
      Color(0xFFE08A5B),
      Color(0xFF8C6FB0),
      Color(0xFFD97A97),
    ],
  );

  static const yellow = GameTheme(
    id: 'yellow',
    displayName: 'Yellow',
    backgroundGradient: [Color(0xFFFFF8E1), Color(0xFFFFEBAF)],
    boardBackground: Color(0xFFFFFFFF),
    boardBorder: Color(0xFFF0D585),
    cellEmpty: Color(0xFFFBF0D2),
    trayBackground: Color(0xFFFFF6DE),
    accentColor: Color(0xFFE3AC3D),
    onAccentColor: Color(0xFF5C4610),
    primaryText: Color(0xFF5C4610),
    secondaryText: Color(0xFFA68A4A),
    decorationIcon: Icons.extension_rounded,
    pieceColors: [
      Color(0xFF3D8FC4),
      Color(0xFF2E6E8E),
      Color(0xFFE0B24A),
      Color(0xFF6FB6A6),
      Color(0xFF7C7FD9),
      Color(0xFFD97A97),
    ],
  );

  static const orange = GameTheme(
    id: 'orange',
    displayName: 'Orange',
    backgroundGradient: [Color(0xFFFFEEDF), Color(0xFFFFD3AC)],
    boardBackground: Color(0xFFFFFBF7),
    boardBorder: Color(0xFFF0B784),
    cellEmpty: Color(0xFFFCE3CC),
    trayBackground: Color(0xFFFFF3E7),
    accentColor: Color(0xFFE0803C),
    onAccentColor: Colors.white,
    primaryText: Color(0xFF5C3319),
    secondaryText: Color(0xFFAD7A54),
    decorationIcon: Icons.extension_rounded,
    pieceColors: [
      Color(0xFFE0703C),
      Color(0xFFD94F6B),
      Color(0xFFE0B24A),
      Color(0xFF8C6FB0),
      Color(0xFF4C9B9B),
      Color(0xFFC65A8C),
    ],
  );

  static const brown = GameTheme(
    id: 'brown',
    displayName: 'Brown',
    backgroundGradient: [Color(0xFF2E2018), Color(0xFF4A3323)],
    boardBackground: Color(0xFF3A281C),
    boardBorder: Color(0xFF6B4A2F),
    cellEmpty: Color(0xFF4A3323),
    trayBackground: Color(0xFF2A1D14),
    accentColor: Color(0xFF9C6B42),
    onAccentColor: Colors.white,
    primaryText: Color(0xFFF0E3D2),
    secondaryText: Color(0xFFC9AE8C),
    decorationIcon: Icons.extension_rounded,
    pieceColors: [
      Color(0xFFE0B24A),
      Color(0xFF5FA8D3),
      Color(0xFF8C6FB0),
      Color(0xFFD97A97),
      Color(0xFF6FB6A6),
      Color(0xFFE08A5B),
    ],
  );

  static const purple = GameTheme(
    id: 'purple',
    displayName: 'Purple',
    backgroundGradient: [Color(0xFF17111F), Color(0xFF2B1E40)],
    boardBackground: Color(0xFF241A33),
    boardBorder: Color(0xFF6A4FA0),
    cellEmpty: Color(0xFF2E2242),
    trayBackground: Color(0xFF1C1428),
    accentColor: Color(0xFF8B5FC4),
    onAccentColor: Colors.white,
    primaryText: Color(0xFFF1E9FB),
    secondaryText: Color(0xFFB9A8D6),
    decorationIcon: Icons.extension_rounded,
    pieceColors: [
      Color(0xFF8B5FC4),
      Color(0xFFE0B24A),
      Color(0xFF5FA8D3),
      Color(0xFFD97A97),
      Color(0xFF4C9B7C),
      Color(0xFFE08A5B),
    ],
  );

  static const List<GameTheme> all = [cream, yellow, orange, brown, purple];

  /// Stage numbers are 1-based; every 10 stages form one theme band.
  static GameTheme forStage(int stageNumber) {
    final band = ((stageNumber - 1) ~/ 10).clamp(0, all.length - 1);
    return all[band];
  }
}
