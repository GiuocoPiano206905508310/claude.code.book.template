import 'package:flutter/material.dart';

import '../models/piece_data.dart';
import '../utils/rotation_utils.dart';
import 'brick_surface.dart';

/// Renders a piece's shape from its coordinate cells — never from a
/// per-rotation image. Rotation is applied to the cell coordinates
/// (see [RotationUtils]) before painting, and each cell animates to its
/// new position so 0/90/180/270 transitions are not instant.
class PuzzlePiece extends StatelessWidget {
  final PieceData piece;
  final int rotationSteps;
  final double cellSize;
  final bool selected;

  const PuzzlePiece({
    super.key,
    required this.piece,
    required this.cellSize,
    this.rotationSteps = 0,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final rotatedCells = RotationUtils.rotateCells(piece.cells, rotationSteps);
    final width = RotationUtils.boundsWidth(rotatedCells);
    final height = RotationUtils.boundsHeight(rotatedCells);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      width: width * cellSize,
      height: height * cellSize,
      decoration: selected
          ? BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              boxShadow: [
                BoxShadow(
                  color: piece.color.withValues(alpha: 0.55),
                  blurRadius: 14,
                  spreadRadius: 2,
                ),
              ],
            )
          : null,
      child: Stack(
        children: [
          for (final cell in rotatedCells)
            AnimatedPositioned(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              left: cell.x * cellSize,
              top: cell.y * cellSize,
              width: cellSize,
              height: cellSize,
              child: _PieceCell(
                color: piece.color,
                selected: selected,
                cellSize: cellSize,
              ),
            ),
        ],
      ),
    );
  }
}

class _PieceCell extends StatelessWidget {
  final Color color;
  final bool selected;
  final double cellSize;

  const _PieceCell({
    required this.color,
    required this.selected,
    required this.cellSize,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(1.5),
      child: BrickSurface(
        color: color,
        borderRadius: cellSize * 0.24,
        borderWidth: (cellSize * (selected ? 0.11 : 0.09)).clamp(1.2, 4.0),
      ),
    );
  }
}
