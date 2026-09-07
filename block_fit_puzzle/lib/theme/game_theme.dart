import 'package:flutter/material.dart';

/// Visual theme applied to a range of 10 stages.
///
/// Everything a screen needs to re-skin itself for a stage band lives here:
/// background gradient, board/tray surfaces, accent (button) color, and the
/// muted color palette used to paint puzzle pieces. Piece colors are kept
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
class GameThemes {
  GameThemes._();

  static const forest = GameTheme(
    id: 'forest',
    displayName: 'Forest',
    backgroundGradient: [Color(0xFFEAF7EE), Color(0xFFCFEEDA)],
    boardBackground: Color(0xFFFFFFFF),
    boardBorder: Color(0xFFBEE3C8),
    cellEmpty: Color(0xFFE4F5E9),
    trayBackground: Color(0xFFF3FBF5),
    accentColor: Color(0xFF2E9E6B),
    onAccentColor: Colors.white,
    primaryText: Color(0xFF1E4632),
    secondaryText: Color(0xFF5C8C74),
    decorationIcon: Icons.eco_rounded,
    pieceColors: [
      Color(0xFF4C9B7C),
      Color(0xFF5FA8D3),
      Color(0xFFE0B24A),
      Color(0xFFE08A5B),
      Color(0xFF8C6FB0),
      Color(0xFFD97A97),
    ],
  );

  static const ocean = GameTheme(
    id: 'ocean',
    displayName: 'Ocean',
    backgroundGradient: [Color(0xFFE4F1FB), Color(0xFFBFDDF3)],
    boardBackground: Color(0xFFFFFFFF),
    boardBorder: Color(0xFFAFCFEA),
    cellEmpty: Color(0xFFE4EFFA),
    trayBackground: Color(0xFFF0F7FC),
    accentColor: Color(0xFF276FBF),
    onAccentColor: Colors.white,
    primaryText: Color(0xFF163A5C),
    secondaryText: Color(0xFF5A82A6),
    decorationIcon: Icons.water_rounded,
    pieceColors: [
      Color(0xFF3D8FC4),
      Color(0xFF2E6E8E),
      Color(0xFFE0B24A),
      Color(0xFF6FB6A6),
      Color(0xFF7C7FD9),
      Color(0xFFD97A97),
    ],
  );

  static const sunset = GameTheme(
    id: 'sunset',
    displayName: 'Sunset',
    backgroundGradient: [Color(0xFFFFF0E1), Color(0xFFFFD6C2)],
    boardBackground: Color(0xFFFFFBF7),
    boardBorder: Color(0xFFF3BE9C),
    cellEmpty: Color(0xFFFBE7DA),
    trayBackground: Color(0xFFFFF5EC),
    accentColor: Color(0xFFE0703C),
    onAccentColor: Colors.white,
    primaryText: Color(0xFF5C2B1E),
    secondaryText: Color(0xFF9C6B54),
    decorationIcon: Icons.wb_twilight_rounded,
    pieceColors: [
      Color(0xFFE0703C),
      Color(0xFFD94F6B),
      Color(0xFFE0B24A),
      Color(0xFF8C6FB0),
      Color(0xFF4C9B9B),
      Color(0xFFC65A8C),
    ],
  );

  static const cosmic = GameTheme(
    id: 'cosmic',
    displayName: 'Cosmic',
    backgroundGradient: [Color(0xFF1B1E3D), Color(0xFF2C2559)],
    boardBackground: Color(0xFF262A4E),
    boardBorder: Color(0xFF454A82),
    cellEmpty: Color(0xFF303462),
    trayBackground: Color(0xFF20233F),
    accentColor: Color(0xFF7C6FE0),
    onAccentColor: Colors.white,
    primaryText: Color(0xFFEDECFB),
    secondaryText: Color(0xFFA6A6D6),
    decorationIcon: Icons.auto_awesome_rounded,
    pieceColors: [
      Color(0xFF7C6FE0),
      Color(0xFF4FA8D8),
      Color(0xFFE0B24A),
      Color(0xFFE0708C),
      Color(0xFF57C2A6),
      Color(0xFFD98CE0),
    ],
  );

  static const royal = GameTheme(
    id: 'royal',
    displayName: 'Royal',
    backgroundGradient: [Color(0xFF15111C), Color(0xFF2A1F3D)],
    boardBackground: Color(0xFF1F1A2C),
    boardBorder: Color(0xFFC9A24B),
    cellEmpty: Color(0xFF2A2438),
    trayBackground: Color(0xFF1A1624),
    accentColor: Color(0xFFC9A24B),
    onAccentColor: Color(0xFF1A1624),
    primaryText: Color(0xFFF2E9D8),
    secondaryText: Color(0xFFB9A8C9),
    decorationIcon: Icons.diamond_rounded,
    pieceColors: [
      Color(0xFFC9A24B),
      Color(0xFF8C6FB0),
      Color(0xFF5FA8D3),
      Color(0xFFD97A97),
      Color(0xFF4C9B7C),
      Color(0xFFE08A5B),
    ],
  );

  static const List<GameTheme> all = [forest, ocean, sunset, cosmic, royal];

  /// Stage numbers are 1-based; every 10 stages form one theme band.
  static GameTheme forStage(int stageNumber) {
    final band = ((stageNumber - 1) ~/ 10).clamp(0, all.length - 1);
    return all[band];
  }
}
