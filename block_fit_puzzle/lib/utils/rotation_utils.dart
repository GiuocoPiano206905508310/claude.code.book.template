import '../models/grid_point.dart';

/// Coordinate-based rotation for piece shapes.
///
/// Pieces are never pre-rendered per orientation; a shape at any of the 4
/// orientations is derived from its base cells with a single transform:
/// 90° clockwise maps (x, y) -> (-y, x). Applying it `times` times covers
/// 0/90/180/270 without needing a lookup table.
class RotationUtils {
  RotationUtils._();

  static List<GridPoint> rotateCells(List<GridPoint> cells, int times) {
    final normalizedTimes = times % 4;
    var result = cells;
    for (var i = 0; i < normalizedTimes; i++) {
      result = result.map((p) => GridPoint(-p.y, p.x)).toList();
    }
    return normalizeToOrigin(result);
  }

  /// Shifts cells so the minimum x and y are both 0, keeping shapes
  /// anchored at their own top-left regardless of rotation.
  static List<GridPoint> normalizeToOrigin(List<GridPoint> cells) {
    if (cells.isEmpty) return cells;
    final minX = cells.map((p) => p.x).reduce((a, b) => a < b ? a : b);
    final minY = cells.map((p) => p.y).reduce((a, b) => a < b ? a : b);
    return cells.map((p) => GridPoint(p.x - minX, p.y - minY)).toList();
  }

  static int boundsWidth(List<GridPoint> cells) {
    if (cells.isEmpty) return 0;
    return cells.map((p) => p.x).reduce((a, b) => a > b ? a : b) + 1;
  }

  static int boundsHeight(List<GridPoint> cells) {
    if (cells.isEmpty) return 0;
    return cells.map((p) => p.y).reduce((a, b) => a > b ? a : b) + 1;
  }
}
