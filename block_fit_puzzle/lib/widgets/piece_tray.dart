import 'package:flutter/material.dart';

import '../models/piece_data.dart';
import '../theme/game_theme.dart';
import 'puzzle_piece.dart';

/// The unused-piece shelf below the board.
///
/// Pieces render small by default; tapping one selects it (enlarge + glow).
/// Pressing and dragging a piece (selected or not) picks it up — the game
/// screen renders the actual floating drag ghost, so a piece currently being
/// dragged is hidden here to avoid showing it twice.
class PieceTray extends StatelessWidget {
  final List<PieceData> pieces;
  final String? selectedPieceId;
  final String? draggingPieceId;
  final Map<String, int> rotations;
  final GameTheme theme;
  final ValueChanged<String> onPieceTap;
  final void Function(String pieceId, DragStartDetails details) onPieceDragStart;
  final void Function(String pieceId, DragUpdateDetails details) onPieceDragUpdate;
  final void Function(String pieceId, DragEndDetails details) onPieceDragEnd;
  final double baseCellSize;
  final double selectedCellSize;

  const PieceTray({
    super.key,
    required this.pieces,
    required this.selectedPieceId,
    required this.draggingPieceId,
    required this.rotations,
    required this.theme,
    required this.onPieceTap,
    required this.onPieceDragStart,
    required this.onPieceDragUpdate,
    required this.onPieceDragEnd,
    this.baseCellSize = 16,
    this.selectedCellSize = 30,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      decoration: BoxDecoration(
        color: theme.trayBackground,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 18,
        runSpacing: 12,
        children: [
          for (final piece in pieces)
            Opacity(
              opacity: piece.id == draggingPieceId ? 0 : 1,
              child: GestureDetector(
                onTap: () => onPieceTap(piece.id),
                onPanStart: (d) => onPieceDragStart(piece.id, d),
                onPanUpdate: (d) => onPieceDragUpdate(piece.id, d),
                onPanEnd: (d) => onPieceDragEnd(piece.id, d),
                child: PuzzlePiece(
                  piece: piece,
                  rotationSteps: rotations[piece.id] ?? 0,
                  cellSize:
                      piece.id == selectedPieceId ? selectedCellSize : baseCellSize,
                  selected: piece.id == selectedPieceId,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
