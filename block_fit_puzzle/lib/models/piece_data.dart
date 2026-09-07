import 'package:flutter/material.dart';

import 'grid_point.dart';

/// Static definition of one puzzle piece shape.
///
/// The shape is stored as a list of grid-relative cell coordinates rather
/// than an image, so rotation is a coordinate transform
/// (see `utils/rotation_utils.dart`) instead of a set of pre-rendered
/// sprites per orientation.
class PieceData {
  final String id;
  final Color color;
  final List<GridPoint> cells;
  final int initialRotation;

  const PieceData({
    required this.id,
    required this.color,
    required this.cells,
    this.initialRotation = 0,
  });
}
