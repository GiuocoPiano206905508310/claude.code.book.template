import '../models/grid_point.dart';
import '../models/piece_data.dart';
import '../models/stage_data.dart';
import '../theme/game_theme.dart';

/// Stage content, kept separate from screens/controllers so game logic
/// never has to know how a board or piece set was authored.
///
/// Phase 1 only needs a single placeholder stage to preview layout, colors,
/// and sizing — the real 50-stage set is built in Phase 4/5.
class Stages {
  Stages._();

  /// A 6-wide x 6-tall irregular board (28 cells) with 5 pieces, used only
  /// to preview board/piece rendering. Not a solved, validated stage yet.
  static StageData previewStage() {
    final palette = GameThemes.cream.pieceColors;

    List<GridPoint> row(int y, int fromX, int toX) =>
        [for (var x = fromX; x <= toX; x++) GridPoint(x, y)];

    final boardCells = [
      ...row(0, 0, 3),
      ...row(1, 0, 4),
      ...row(2, 1, 5),
      ...row(3, 1, 5),
      ...row(4, 0, 4),
      ...row(5, 0, 3),
    ];

    final pieces = [
      PieceData(
        id: 'A',
        color: palette[0],
        cells: const [
          GridPoint(0, 0),
          GridPoint(0, 1),
          GridPoint(0, 2),
          GridPoint(1, 2),
        ],
      ),
      PieceData(
        id: 'B',
        color: palette[1],
        cells: const [
          GridPoint(0, 0),
          GridPoint(1, 0),
          GridPoint(2, 0),
          GridPoint(3, 0),
        ],
      ),
      PieceData(
        id: 'C',
        color: palette[2],
        cells: const [
          GridPoint(0, 0),
          GridPoint(1, 0),
          GridPoint(1, 1),
          GridPoint(2, 1),
        ],
      ),
      PieceData(
        id: 'D',
        color: palette[3],
        cells: const [
          GridPoint(0, 0),
          GridPoint(1, 0),
          GridPoint(0, 1),
          GridPoint(1, 1),
        ],
      ),
      PieceData(
        id: 'E',
        color: palette[4],
        cells: const [
          GridPoint(0, 0),
          GridPoint(1, 0),
          GridPoint(2, 0),
          GridPoint(1, 1),
        ],
      ),
    ];

    return StageData(
      id: 1,
      width: 6,
      height: 6,
      boardCells: boardCells,
      pieces: pieces,
      solution: const [],
    );
  }
}
