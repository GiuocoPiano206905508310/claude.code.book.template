/// Integer grid coordinate used for board cells and piece shapes.
///
/// Kept as a tiny value type (rather than `dart:math`'s `Point<int>`) so
/// rotation math in `utils/rotation_utils.dart` can stay simple:
/// 90° clockwise is `(x, y) -> (-y, x)`.
class GridPoint {
  final int x;
  final int y;

  const GridPoint(this.x, this.y);

  @override
  bool operator ==(Object other) =>
      other is GridPoint && other.x == x && other.y == y;

  @override
  int get hashCode => Object.hash(x, y);

  @override
  String toString() => '($x, $y)';
}
