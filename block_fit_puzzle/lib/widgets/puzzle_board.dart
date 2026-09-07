import 'package:flutter/material.dart';

import '../controllers/puzzle_controller.dart';
import '../models/grid_point.dart';
import '../models/piece_data.dart';
import '../models/placed_piece.dart';
import '../models/stage_data.dart';
import '../theme/game_theme.dart';
import '../utils/rotation_utils.dart';
import 'brick_surface.dart';

/// The bordered play area for a stage.
///
/// The board's outer shape comes purely from [StageData.boardCells] — a set
/// of grid cells, not a special "shape" — so irregular outlines (L-shapes,
/// crosses, donuts) are just a different cell set, with no extra rendering
/// code. Cell size is derived from the available layout space so the same
/// stage fits small and large phone screens alike.
///
/// [gridKey] is attached to the exact-sized grid box (not the padded/bordered
/// frame around it) so the game screen can read its real on-screen rect back
/// via [RenderBox] to convert drag pointer positions into grid cells.
class PuzzleBoard extends StatelessWidget {
  final StageData stage;
  final GameTheme theme;
  final PuzzleController controller;
  final GlobalKey gridKey;
  final String? draggingPieceId;
  final GridPoint? hoverOrigin;
  final int hoverRotation;
  final bool hoverValid;
  final void Function(String pieceId, DragStartDetails details) onPieceDragStart;
  final void Function(String pieceId, DragUpdateDetails details) onPieceDragUpdate;
  final void Function(String pieceId, DragEndDetails details) onPieceDragEnd;
  final ValueChanged<String> onPieceTap;

  const PuzzleBoard({
    super.key,
    required this.stage,
    required this.theme,
    required this.controller,
    required this.gridKey,
    required this.draggingPieceId,
    required this.hoverOrigin,
    required this.hoverRotation,
    required this.hoverValid,
    required this.onPieceDragStart,
    required this.onPieceDragUpdate,
    required this.onPieceDragEnd,
    required this.onPieceTap,
  });

  @override
  Widget build(BuildContext context) {
    final boardCellSet = stage.boardCells.toSet();

    // The frame's padding must be reserved *before* dividing up the
    // available space for cells — otherwise the grid box asks for
    // cellSize*stage.width/height, the padding then eats into that same
    // budget, and the outer Container (which isn't given an explicit size)
    // clamps down to fit, silently shrinking the rendered grid below what
    // the cell math assumes. Cells positioned via the original, larger
    // cellSize then spill out past the padded/bordered frame on the right
    // and bottom edges.
    const framePadding = 10.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final cellSize = [
          (constraints.maxWidth - framePadding * 2) / stage.width,
          (constraints.maxHeight - framePadding * 2) / stage.height,
        ].reduce((a, b) => a < b ? a : b);
        final gridWidth = cellSize * stage.width;
        final gridHeight = cellSize * stage.height;

        return Center(
          child: Container(
            width: gridWidth + framePadding * 2,
            height: gridHeight + framePadding * 2,
            padding: const EdgeInsets.all(framePadding),
            decoration: BoxDecoration(
              color: theme.boardBackground,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: theme.boardBorder, width: 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: SizedBox(
              key: gridKey,
              width: gridWidth,
              height: gridHeight,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  for (var y = 0; y < stage.height; y++)
                    for (var x = 0; x < stage.width; x++)
                      if (boardCellSet.contains(GridPoint(x, y)))
                        Positioned(
                          left: x * cellSize,
                          top: y * cellSize,
                          width: cellSize,
                          height: cellSize,
                          child: Padding(
                            padding: const EdgeInsets.all(1.5),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: theme.cellEmpty,
                                borderRadius: BorderRadius.circular(cellSize * 0.12),
                              ),
                            ),
                          ),
                        ),
                  if (hoverOrigin != null && draggingPieceId != null)
                    for (final cell in RotationUtils.rotateCells(
                      controller.stage.pieces
                          .firstWhere((p) => p.id == draggingPieceId)
                          .cells,
                      hoverRotation,
                    ))
                      Positioned(
                        left: (hoverOrigin!.x + cell.x) * cellSize,
                        top: (hoverOrigin!.y + cell.y) * cellSize,
                        width: cellSize,
                        height: cellSize,
                        child: Padding(
                          padding: const EdgeInsets.all(1.5),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: (hoverValid ? Colors.green : Colors.red)
                                  .withValues(alpha: 0.32),
                              borderRadius: BorderRadius.circular(cellSize * 0.12),
                            ),
                          ),
                        ),
                      ),
                  for (final piece in controller.placedPieces)
                    if (piece.id != draggingPieceId)
                      _PlacedPieceView(
                        piece: piece,
                        placement: controller.placementOf(piece.id)!,
                        cellSize: cellSize,
                        selected: controller.selectedPieceId == piece.id,
                        onTap: () => onPieceTap(piece.id),
                        onDragStart: (d) => onPieceDragStart(piece.id, d),
                        onDragUpdate: (d) => onPieceDragUpdate(piece.id, d),
                        onDragEnd: (d) => onPieceDragEnd(piece.id, d),
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

class _PlacedPieceView extends StatelessWidget {
  final PieceData piece;
  final PlacedPiece placement;
  final double cellSize;
  final bool selected;
  final VoidCallback onTap;
  final GestureDragStartCallback onDragStart;
  final GestureDragUpdateCallback onDragUpdate;
  final GestureDragEndCallback onDragEnd;

  const _PlacedPieceView({
    required this.piece,
    required this.placement,
    required this.cellSize,
    required this.selected,
    required this.onTap,
    required this.onDragStart,
    required this.onDragUpdate,
    required this.onDragEnd,
  });

  @override
  Widget build(BuildContext context) {
    final rotatedCells = RotationUtils.rotateCells(piece.cells, placement.rotation);
    final origin = placement.origin;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        for (final cell in rotatedCells)
          Positioned(
            left: (origin.x + cell.x) * cellSize,
            top: (origin.y + cell.y) * cellSize,
            width: cellSize,
            height: cellSize,
            child: GestureDetector(
              onTap: onTap,
              onPanStart: onDragStart,
              onPanUpdate: onDragUpdate,
              onPanEnd: onDragEnd,
              child: Padding(
                padding: const EdgeInsets.all(1.5),
                child: BrickSurface(
                  color: piece.color,
                  borderRadius: cellSize * 0.12,
                  borderWidth: (cellSize * (selected ? 0.15 : 0.13)).clamp(1.6, 5.0),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
