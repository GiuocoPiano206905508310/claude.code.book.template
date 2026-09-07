import 'package:flutter/material.dart';

import '../models/piece_data.dart';
import '../theme/game_theme.dart';
import 'puzzle_piece.dart';

/// The unused-piece shelf below the board.
///
/// Pieces render small by default; tapping one selects it, which enlarges
/// it and gives it a selection glow (per design spec: obvious but not
/// flashy). Drag-to-place is Phase 2 — this preview only demonstrates the
/// tap/select/rotate visual language.
class PieceTray extends StatelessWidget {
  final List<PieceData> pieces;
  final String? selectedPieceId;
  final Map<String, int> rotations;
  final GameTheme theme;
  final ValueChanged<String> onPieceTap;
  final double baseCellSize;
  final double selectedCellSize;

  const PieceTray({
    super.key,
    required this.pieces,
    required this.selectedPieceId,
    required this.rotations,
    required this.theme,
    required this.onPieceTap,
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
            GestureDetector(
              onTap: () => onPieceTap(piece.id),
              child: PuzzlePiece(
                piece: piece,
                rotationSteps: rotations[piece.id] ?? 0,
                cellSize:
                    piece.id == selectedPieceId ? selectedCellSize : baseCellSize,
                selected: piece.id == selectedPieceId,
              ),
            ),
        ],
      ),
    );
  }
}
