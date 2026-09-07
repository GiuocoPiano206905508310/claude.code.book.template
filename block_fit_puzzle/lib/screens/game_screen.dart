import 'package:flutter/material.dart';

import '../controllers/game_controller.dart';
import '../controllers/puzzle_controller.dart';
import '../data/stages.dart';
import '../models/grid_point.dart';
import '../models/piece_data.dart';
import '../models/stage_data.dart';
import '../theme/game_theme.dart';
import '../utils/rotation_utils.dart';
import '../widgets/game_button.dart';
import '../widgets/piece_tray.dart';
import '../widgets/puzzle_board.dart';
import '../widgets/puzzle_piece.dart';
import '../widgets/settings_sheet.dart';

/// Stage 1's live play screen: drag pieces from the tray (or pick a placed
/// one back up) and drop them onto the board. Placement snaps to the
/// nearest grid cell and is only accepted when every cell of the piece
/// lands inside the board's shape and doesn't overlap another piece —
/// otherwise the piece simply stays where it was. Clear detection, hints,
/// and save/restore are Phase 3.
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
  late final PuzzleController _controller = PuzzleController(_stage);

  final GlobalKey _stackKey = GlobalKey();
  final GlobalKey _boardGridKey = GlobalKey();

  String? _draggingPieceId;
  int _draggingRotation = 0;
  double _draggingCellSize = 32;
  Offset? _dragGhostLocalPosition;
  GridPoint? _hoverOrigin;
  bool _hoverValid = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  PieceData _pieceById(String pieceId) =>
      _stage.pieces.firstWhere((p) => p.id == pieceId);

  void _handleDragStart(String pieceId, DragStartDetails details) {
    final boardBox = _boardGridKey.currentContext?.findRenderObject() as RenderBox?;
    final cellSize = (boardBox != null && boardBox.hasSize)
        ? boardBox.size.width / _stage.width
        : _draggingCellSize;

    _controller.setSelected(pieceId);
    _draggingPieceId = pieceId;
    _draggingRotation = _controller.rotationOf(pieceId);
    _draggingCellSize = cellSize;
    _updateGhost(pieceId, details.globalPosition);
  }

  void _handleDragUpdate(String pieceId, DragUpdateDetails details) {
    if (_draggingPieceId != pieceId) return;
    _updateGhost(pieceId, details.globalPosition);
  }

  void _updateGhost(String pieceId, Offset globalPointer) {
    final piece = _pieceById(pieceId);
    final rotatedCells = RotationUtils.rotateCells(piece.cells, _draggingRotation);
    final w = RotationUtils.boundsWidth(rotatedCells) * _draggingCellSize;
    final h = RotationUtils.boundsHeight(rotatedCells) * _draggingCellSize;
    // The ghost floats above and centered on the finger so the piece being
    // placed is never hidden under the hand holding it.
    final liftOffset = Offset(w / 2, h / 2 + _draggingCellSize * 1.4);
    final ghostGlobalTopLeft = globalPointer - liftOffset;

    Offset? stackLocal;
    final stackBox = _stackKey.currentContext?.findRenderObject() as RenderBox?;
    if (stackBox != null && stackBox.hasSize) {
      stackLocal = stackBox.globalToLocal(ghostGlobalTopLeft);
    }

    GridPoint? hoverOrigin;
    var hoverValid = false;
    final boardBox = _boardGridKey.currentContext?.findRenderObject() as RenderBox?;
    if (boardBox != null && boardBox.hasSize) {
      final boardLocal = boardBox.globalToLocal(ghostGlobalTopLeft);
      final origin = GridPoint(
        (boardLocal.dx / _draggingCellSize).round(),
        (boardLocal.dy / _draggingCellSize).round(),
      );
      hoverOrigin = origin;
      hoverValid = _controller.canPlace(pieceId, origin, _draggingRotation);
    }

    setState(() {
      _dragGhostLocalPosition = stackLocal;
      _hoverOrigin = hoverOrigin;
      _hoverValid = hoverValid;
    });
  }

  void _handleDragEnd(String pieceId, DragEndDetails details) {
    if (_draggingPieceId != pieceId) return;
    final origin = _hoverOrigin;
    if (origin != null && _hoverValid) {
      _controller.tryPlace(pieceId, origin, _draggingRotation);
    }
    setState(() {
      _draggingPieceId = null;
      _dragGhostLocalPosition = null;
      _hoverOrigin = null;
      _hoverValid = false;
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
                _controller.resetAll();
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
      animation: Listenable.merge([widget.appState, _controller]),
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
              child: Stack(
                key: _stackKey,
                children: [
                  Column(
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
                          child: PuzzleBoard(
                            stage: _stage,
                            theme: theme,
                            controller: _controller,
                            gridKey: _boardGridKey,
                            draggingPieceId: _draggingPieceId,
                            hoverOrigin: _hoverOrigin,
                            hoverRotation: _draggingRotation,
                            hoverValid: _hoverValid,
                            onPieceTap: _controller.toggleSelect,
                            onPieceDragStart: _handleDragStart,
                            onPieceDragUpdate: _handleDragUpdate,
                            onPieceDragEnd: _handleDragEnd,
                          ),
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
                          pieces: _controller.trayPieces,
                          selectedPieceId: _controller.selectedPieceId,
                          draggingPieceId: _draggingPieceId,
                          rotations: {
                            for (final p in _controller.trayPieces)
                              p.id: _controller.rotationOf(p.id),
                          },
                          theme: theme,
                          onPieceTap: _controller.toggleSelect,
                          onPieceDragStart: _handleDragStart,
                          onPieceDragUpdate: _handleDragUpdate,
                          onPieceDragEnd: _handleDragEnd,
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
                          onTap: _controller.selectedPieceId == null
                              ? null
                              : _controller.rotateSelected,
                        ),
                      ),
                    ],
                  ),
                  if (_draggingPieceId != null && _dragGhostLocalPosition != null)
                    Positioned(
                      left: _dragGhostLocalPosition!.dx,
                      top: _dragGhostLocalPosition!.dy,
                      child: IgnorePointer(
                        child: Opacity(
                          opacity: 0.9,
                          child: PuzzlePiece(
                            piece: _pieceById(_draggingPieceId!),
                            rotationSteps: _draggingRotation,
                            cellSize: _draggingCellSize,
                            selected: true,
                          ),
                        ),
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
