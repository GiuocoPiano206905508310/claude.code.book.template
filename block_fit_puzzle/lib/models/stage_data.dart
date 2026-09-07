import 'grid_point.dart';
import 'piece_data.dart';
import 'placed_piece.dart';

/// Static definition of one stage: its board outline, the pieces available
/// to fill it, and a known-good solution kept for hints/validation/debug.
///
/// Board shape is a set of grid cells (a bounding box of [width] x [height]
/// with holes), not a special "shape" enum — this is what lets stage
/// outlines get arbitrarily irregular (L-shapes, crosses, donuts, ...)
/// while placement/collision code stays a simple cell-set check.
class StageData {
  final int id;
  final int width;
  final int height;
  final List<GridPoint> boardCells;
  final List<PieceData> pieces;
  final List<PlacedPiece> solution;

  const StageData({
    required this.id,
    required this.width,
    required this.height,
    required this.boardCells,
    required this.pieces,
    required this.solution,
  });
}
