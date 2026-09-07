import 'grid_point.dart';

/// Where one piece currently sits on the board, once Phase 2 adds
/// placement logic. Not used by the Phase 1 UI preview.
class PlacedPiece {
  final String pieceId;
  final GridPoint origin;
  final int rotation;

  const PlacedPiece({
    required this.pieceId,
    required this.origin,
    this.rotation = 0,
  });

  PlacedPiece copyWith({GridPoint? origin, int? rotation}) => PlacedPiece(
        pieceId: pieceId,
        origin: origin ?? this.origin,
        rotation: rotation ?? this.rotation,
      );
}
