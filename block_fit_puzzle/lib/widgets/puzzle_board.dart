import 'package:flutter/material.dart';

import '../models/grid_point.dart';
import '../models/stage_data.dart';
import '../theme/game_theme.dart';

/// The bordered play area for a stage.
///
/// The board's outer shape comes purely from [StageData.boardCells] — a set
/// of grid cells, not a special "shape" — so irregular outlines (L-shapes,
/// crosses, donuts) are just a different cell set, with no extra rendering
/// code. Cell size is derived from the available layout space so the same
/// stage fits small and large phone screens alike.
class PuzzleBoard extends StatelessWidget {
  final StageData stage;
  final GameTheme theme;

  const PuzzleBoard({super.key, required this.stage, required this.theme});

  @override
  Widget build(BuildContext context) {
    final boardCellSet = stage.boardCells.toSet();

    return LayoutBuilder(
      builder: (context, constraints) {
        final cellSize = [
          constraints.maxWidth / stage.width,
          constraints.maxHeight / stage.height,
        ].reduce((a, b) => a < b ? a : b);

        return Center(
          child: Container(
            width: cellSize * stage.width,
            height: cellSize * stage.height,
            padding: const EdgeInsets.all(6),
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
            child: Stack(
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
                              borderRadius: BorderRadius.circular(5),
                            ),
                          ),
                        ),
                      ),
              ],
            ),
          ),
        );
      },
    );
  }
}
