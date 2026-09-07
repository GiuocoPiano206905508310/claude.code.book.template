import 'package:flutter/foundation.dart';

import '../models/grid_point.dart';
import '../models/piece_data.dart';
import '../models/placed_piece.dart';
import '../models/stage_data.dart';
import '../utils/rotation_utils.dart';

/// Owns Stage 1's live play state: which pieces are still in the tray vs.
/// placed on the board, their rotations, the current selection, and the
/// placement rules (bounds + collision) that decide whether a drop is legal.
///
/// Kept separate from the screen/widgets so drag gesture code only has to
/// ask "can this go here?" / "put it here" rather than re-deriving grid math.
class PuzzleController extends ChangeNotifier {
  final StageData stage;
  late final Set<GridPoint> _boardCellSet = stage.boardCells.toSet();
  late final Map<String, PieceData> _piecesById = {
    for (final p in stage.pieces) p.id: p,
  };

  final Map<String, int> _trayRotations = {};
  final Map<String, PlacedPiece> _placements = {};
  String? _selectedPieceId;

  PuzzleController(this.stage);

  String? get selectedPieceId => _selectedPieceId;

  bool isPlaced(String pieceId) => _placements.containsKey(pieceId);

  PlacedPiece? placementOf(String pieceId) => _placements[pieceId];

  int rotationOf(String pieceId) =>
      _placements[pieceId]?.rotation ?? _trayRotations[pieceId] ?? 0;

  List<PieceData> get trayPieces =>
      stage.pieces.where((p) => !isPlaced(p.id)).toList();

  List<PieceData> get placedPieces =>
      stage.pieces.where((p) => isPlaced(p.id)).toList();

  /// True once every board cell is covered exactly once by a placed piece.
  bool get isCleared {
    if (_placements.length != stage.pieces.length) return false;
    final filled = <GridPoint>{};
    for (final entry in _placements.entries) {
      filled.addAll(_cellsFor(entry.key, entry.value.origin, entry.value.rotation));
    }
    return filled.length == _boardCellSet.length;
  }

  /// Toggles selection — used by tapping a piece to select/deselect it.
  void toggleSelect(String pieceId) {
    _selectedPieceId = _selectedPieceId == pieceId ? null : pieceId;
    notifyListeners();
  }

  /// Forces selection to exactly [pieceId] (or clears it) — used when
  /// picking a piece up to drag, where a toggle would be surprising.
  void setSelected(String? pieceId) {
    _selectedPieceId = pieceId;
    notifyListeners();
  }

  /// Rotates the selected piece 90° clockwise, whether it's still in the
  /// tray or already placed. A placed piece only rotates if the rotated
  /// shape still fits; an illegal rotation is silently ignored rather than
  /// leaving the piece overlapping something.
  void rotateSelected() {
    final id = _selectedPieceId;
    if (id == null) return;
    final placed = _placements[id];
    if (placed == null) {
      _trayRotations[id] = (rotationOf(id) + 1) % 4;
      notifyListeners();
      return;
    }
    final newRotation = (placed.rotation + 1) % 4;
    if (_fits(id, placed.origin, newRotation)) {
      _placements[id] = placed.copyWith(rotation: newRotation);
      notifyListeners();
    }
  }

  List<GridPoint> _cellsFor(String pieceId, GridPoint origin, int rotation) {
    final piece = _piecesById[pieceId]!;
    final rotated = RotationUtils.rotateCells(piece.cells, rotation);
    return [for (final c in rotated) GridPoint(c.x + origin.x, c.y + origin.y)];
  }

  bool _fits(String pieceId, GridPoint origin, int rotation) {
    final cells = _cellsFor(pieceId, origin, rotation);
    for (final cell in cells) {
      if (!_boardCellSet.contains(cell)) return false;
    }
    for (final entry in _placements.entries) {
      if (entry.key == pieceId) continue;
      final otherCells = _cellsFor(entry.key, entry.value.origin, entry.value.rotation);
      for (final cell in cells) {
        if (otherCells.contains(cell)) return false;
      }
    }
    return true;
  }

  /// Whether [pieceId] could legally be dropped at [origin] with [rotation]:
  /// every cell must be inside the stage's board shape and not already
  /// covered by another placed piece.
  bool canPlace(String pieceId, GridPoint origin, int rotation) =>
      _fits(pieceId, origin, rotation);

  /// Attempts to place (or re-place) [pieceId]. Returns whether it landed.
  bool tryPlace(String pieceId, GridPoint origin, int rotation) {
    if (!_fits(pieceId, origin, rotation)) return false;
    _placements[pieceId] = PlacedPiece(pieceId: pieceId, origin: origin, rotation: rotation);
    notifyListeners();
    return true;
  }

  /// Returns everything to the tray and clears the selection — the "restart
  /// this stage" action.
  void resetAll() {
    _placements.clear();
    _trayRotations.clear();
    _selectedPieceId = null;
    notifyListeners();
  }
}
