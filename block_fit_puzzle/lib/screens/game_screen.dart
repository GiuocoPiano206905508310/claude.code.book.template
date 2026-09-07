import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../data/stages.dart';
import '../models/stage_data.dart';
import '../theme/game_theme.dart';
import '../widgets/game_button.dart';
import '../widgets/piece_tray.dart';
import '../widgets/puzzle_board.dart';
import '../widgets/settings_sheet.dart';

/// Phase 1 preview of the in-game screen: layout, board, tray, and button
/// placement only. Tapping a tray piece selects/enlarges it and the rotate
/// button spins the *selected* piece's preview — there is no drag, snap,
/// collision, or clear detection yet (that's Phase 2/3).
class GameScreen extends StatefulWidget {
  final AppState appState;
  final int stageNumber;

  const GameScreen({
    super.key,
    required this.appState,
    required this.stageNumber,
  });

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final StageData _stage = Stages.previewStage();
  String? _selectedPieceId;
  final Map<String, int> _rotations = {};

  void _onPieceTap(String pieceId) {
    setState(() {
      _selectedPieceId = _selectedPieceId == pieceId ? null : pieceId;
    });
  }

  void _onRotateTap() {
    if (_selectedPieceId == null) return;
    setState(() {
      final current = _rotations[_selectedPieceId!] ?? 0;
      _rotations[_selectedPieceId!] = (current + 1) % 4;
    });
  }

  void _showHowToPlay(GameTheme theme) {
    showModalBottomSheet(
      context: context,
      backgroundColor: theme.boardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '遊び方',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: theme.primaryText,
              ),
            ),
            const SizedBox(height: 16),
            _HowToStep(
              icon: Icons.touch_app_rounded,
              text: 'ブロックをタップして選択',
              theme: theme,
            ),
            _HowToStep(
              icon: Icons.open_with_rounded,
              text: '指で好きな位置へドラッグ',
              theme: theme,
            ),
            _HowToStep(
              icon: Icons.rotate_right_rounded,
              text: '回転ボタンで90°回転',
              theme: theme,
            ),
            _HowToStep(
              icon: Icons.grid_view_rounded,
              text: 'すべてのマスを隙間なく埋めればクリア',
              theme: theme,
            ),
          ],
        ),
      ),
    );
  }

  void _showHint(GameTheme theme) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: theme.boardBackground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('ヒント', style: TextStyle(color: theme.primaryText)),
        content: Text(
          'このブロックはここに置けます。\n（ヒント表示はPhase 3で実装予定のプレビューです）',
          style: TextStyle(color: theme.secondaryText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('OK', style: TextStyle(color: theme.accentColor)),
          ),
        ],
      ),
    );
  }

  void _restartStage() {
    setState(() {
      _selectedPieceId = null;
      _rotations.clear();
    });
  }

  void _showPauseMenu(GameTheme theme) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: theme.boardBackground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          '中断中',
          textAlign: TextAlign.center,
          style: TextStyle(color: theme.accentColor, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '進行状況はクリア時に自動保存されます。',
              textAlign: TextAlign.center,
              style: TextStyle(color: theme.secondaryText),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.accentColor,
                  foregroundColor: theme.onAccentColor,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(25),
                  ),
                ),
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('つづける', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                _restartStage();
              },
              child: Text(
                'このステージをやり直す',
                style: TextStyle(color: theme.primaryText),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                Navigator.of(context).pop();
              },
              child: Text('ステージ選択へ', style: TextStyle(color: theme.secondaryText)),
            ),
          ],
        ),
      ),
    );
  }

  void _pickPreviewTheme(GameTheme? theme) {
    widget.appState.setPreviewTheme(theme);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.appState,
      builder: (context, _) {
        final theme = widget.appState.effectiveTheme(widget.stageNumber);

        return Scaffold(
          body: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: theme.backgroundGradient,
              ),
            ),
            child: SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            GameButton(
                              icon: Icons.grid_view_rounded,
                              backgroundColor: theme.accentColor,
                              iconColor: theme.onAccentColor,
                              semanticLabel: 'ホームへ',
                              onTap: () => Navigator.of(context)
                                  .popUntil((route) => route.isFirst),
                            ),
                            GameButton(
                              icon: Icons.help_outline_rounded,
                              backgroundColor: theme.accentColor,
                              iconColor: theme.onAccentColor,
                              semanticLabel: '遊び方',
                              onTap: () => _showHowToPlay(theme),
                            ),
                            GameButton(
                              icon: Icons.priority_high_rounded,
                              backgroundColor: theme.accentColor,
                              iconColor: theme.onAccentColor,
                              semanticLabel: 'ヒント',
                              onTap: () => _showHint(theme),
                            ),
                            GameButton(
                              icon: Icons.pause_rounded,
                              backgroundColor: theme.accentColor,
                              iconColor: theme.onAccentColor,
                              semanticLabel: '中断',
                              onTap: () => _showPauseMenu(theme),
                            ),
                            GameButton(
                              icon: Icons.settings_rounded,
                              backgroundColor: theme.accentColor,
                              iconColor: theme.onAccentColor,
                              semanticLabel: '設定',
                              onTap: () =>
                                  showSettingsSheet(context, widget.appState, theme),
                            ),
                          ],
                        ),
                      ),
                      _StageHeader(
                        stageNumber: widget.stageNumber,
                        theme: theme,
                        onPickTheme: _pickPreviewTheme,
                      ),
                      Expanded(
                        flex: 5,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 8),
                          child: PuzzleBoard(stage: _stage, theme: theme),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '使用するブロック',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: theme.secondaryText,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: PieceTray(
                          pieces: _stage.pieces,
                          selectedPieceId: _selectedPieceId,
                          rotations: _rotations,
                          theme: theme,
                          onPieceTap: _onPieceTap,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: GameButton(
                          icon: Icons.rotate_right_rounded,
                          label: '90°',
                          backgroundColor: theme.accentColor,
                          iconColor: theme.onAccentColor,
                          size: 56,
                          semanticLabel: '90度回転',
                          onTap: _selectedPieceId == null ? null : _onRotateTap,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The stage label line below the 5 main utility buttons: a band decoration
/// icon, "Stage N", and a small secondary palette button for the Phase 1
/// theme-band preview switcher (not one of the 5 evenly-spaced buttons).
class _StageHeader extends StatelessWidget {
  final int stageNumber;
  final GameTheme theme;
  final ValueChanged<GameTheme?> onPickTheme;

  const _StageHeader({
    required this.stageNumber,
    required this.theme,
    required this.onPickTheme,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(theme.decorationIcon, size: 18, color: theme.accentColor),
        const SizedBox(width: 6),
        Text(
          'Stage $stageNumber',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color: theme.primaryText,
          ),
        ),
        PopupMenuButton<GameTheme?>(
          icon: Icon(Icons.palette_outlined, size: 18, color: theme.secondaryText),
          tooltip: 'テーマプレビュー切替',
          onSelected: onPickTheme,
          itemBuilder: (context) => [
            const PopupMenuItem(value: null, child: Text('ステージ通り')),
            for (final t in GameThemes.all)
              PopupMenuItem(value: t, child: Text(t.displayName)),
          ],
        ),
      ],
    );
  }
}

class _HowToStep extends StatelessWidget {
  final IconData icon;
  final String text;
  final GameTheme theme;

  const _HowToStep({
    required this.icon,
    required this.text,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: theme.accentColor,
            child: Icon(icon, size: 18, color: theme.onAccentColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(text, style: TextStyle(color: theme.primaryText, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
