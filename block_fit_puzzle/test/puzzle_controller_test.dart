import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:block_fit_puzzle/controllers/puzzle_controller.dart';
import 'package:block_fit_puzzle/models/grid_point.dart';
import 'package:block_fit_puzzle/models/piece_data.dart';
import 'package:block_fit_puzzle/models/stage_data.dart';

/// A tiny 4x2 stage, fully rectangular, with two 2x1 dominoes — small and
/// fully hand-checkable, so the expected origins/overlaps below are exact
/// rather than eyeballed off a screenshot.
///
/// Layout (all 8 cells valid):
///   (0,0)(1,0)(2,0)(3,0)
///   (0,1)(1,1)(2,1)(3,1)
StageData _testStage() {
  final boardCells = [
    for (var y = 0; y < 2; y++)
      for (var x = 0; x < 4; x++) GridPoint(x, y),
  ];
  final pieces = [
    const PieceData(
      id: 'A',
      color: Colors.red,
      cells: [GridPoint(0, 0), GridPoint(1, 0)],
    ),
    const PieceData(
      id: 'B',
      color: Colors.blue,
      cells: [GridPoint(0, 0), GridPoint(1, 0)],
    ),
  ];
  return StageData(
    id: 999,
    width: 4,
    height: 2,
    boardCells: boardCells,
    pieces: pieces,
    solution: const [],
  );
}

void main() {
  group('PuzzleController placement rules', () {
    test('canPlace is true for an in-bounds, non-overlapping spot', () {
      final controller = PuzzleController(_testStage());
      expect(controller.canPlace('A', const GridPoint(0, 0), 0), isTrue);
      expect(controller.canPlace('A', const GridPoint(2, 1), 0), isTrue);
    });

    test('canPlace is false when any cell falls outside the board shape', () {
      final controller = PuzzleController(_testStage());
      // (3,0)+(4,0) — the second cell is off the 4-wide board.
      expect(controller.canPlace('A', const GridPoint(3, 0), 0), isFalse);
      // Negative origin also falls outside.
      expect(controller.canPlace('A', const GridPoint(-1, 0), 0), isFalse);
    });

    test('tryPlace places a piece and canPlace then reports true occupancy',
        () {
      final controller = PuzzleController(_testStage());
      expect(controller.tryPlace('A', const GridPoint(0, 0), 0), isTrue);
      expect(controller.isPlaced('A'), isTrue);
      expect(controller.placementOf('A')!.origin, const GridPoint(0, 0));
    });

    test('canPlace is false for a spot overlapping an already-placed piece',
        () {
      final controller = PuzzleController(_testStage());
      controller.tryPlace('A', const GridPoint(0, 0), 0); // covers (0,0),(1,0)

      // B at (1,0) would cover (1,0),(2,0) — (1,0) collides with A.
      expect(controller.canPlace('B', const GridPoint(1, 0), 0), isFalse);
      // B at (2,0) covers (2,0),(3,0) — clear of A.
      expect(controller.canPlace('B', const GridPoint(2, 0), 0), isTrue);
    });

    test('tryPlace refuses an overlapping drop and leaves state unchanged',
        () {
      final controller = PuzzleController(_testStage());
      controller.tryPlace('A', const GridPoint(0, 0), 0);

      final accepted = controller.tryPlace('B', const GridPoint(1, 0), 0);

      expect(accepted, isFalse);
      expect(controller.isPlaced('B'), isFalse);
      // A must be completely untouched by the rejected attempt.
      expect(controller.placementOf('A')!.origin, const GridPoint(0, 0));
    });

    test('a placed piece can be legally moved to a new non-overlapping spot',
        () {
      final controller = PuzzleController(_testStage());
      controller.tryPlace('A', const GridPoint(0, 0), 0);

      // Re-placing A itself must not be blocked by A's own old position.
      expect(controller.canPlace('A', const GridPoint(1, 0), 0), isTrue);
      expect(controller.tryPlace('A', const GridPoint(1, 0), 0), isTrue);
      expect(controller.placementOf('A')!.origin, const GridPoint(1, 0));
    });

    test('rotateSelected rotates a tray piece unconditionally', () {
      final controller = PuzzleController(_testStage());
      controller.setSelected('A');
      expect(controller.rotationOf('A'), 0);
      controller.rotateSelected();
      expect(controller.rotationOf('A'), 1);
    });

    test('rotateSelected on a placed piece is ignored if the rotation would '
        'collide with another placed piece', () {
      final controller = PuzzleController(_testStage());
      // A horizontal at (0,0)-(1,0); B horizontal at (0,1)-(1,1), directly
      // beneath A. Rotating A 90 degrees needs (0,0),(0,1) — (0,1) is
      // occupied by B, so the rotation must be rejected and A left as-is.
      controller.tryPlace('A', const GridPoint(0, 0), 0);
      controller.tryPlace('B', const GridPoint(0, 1), 0);

      controller.setSelected('A');
      controller.rotateSelected();

      expect(controller.placementOf('A')!.rotation, 0);
      expect(controller.placementOf('A')!.origin, const GridPoint(0, 0));
    });

    test('rotateSelected on a placed piece applies the rotation when it '
        'still fits', () {
      final controller = PuzzleController(_testStage());
      controller.tryPlace('A', const GridPoint(2, 0), 0); // (2,0),(3,0)

      controller.setSelected('A');
      controller.rotateSelected();

      // Rotated 90 degrees clockwise, the domino becomes vertical: (2,0),(2,1).
      expect(controller.placementOf('A')!.rotation, 1);
      expect(controller.canPlace('B', const GridPoint(2, 1), 0), isFalse);
    });

    test('resetAll clears every placement, rotation, and selection', () {
      final controller = PuzzleController(_testStage());
      controller.tryPlace('A', const GridPoint(0, 0), 0);
      controller.setSelected('B');
      controller.rotateSelected();

      controller.resetAll();

      expect(controller.isPlaced('A'), isFalse);
      expect(controller.rotationOf('B'), 0);
      expect(controller.selectedPieceId, isNull);
      expect(controller.trayPieces.map((p) => p.id), containsAll(['A', 'B']));
    });
  });
}
