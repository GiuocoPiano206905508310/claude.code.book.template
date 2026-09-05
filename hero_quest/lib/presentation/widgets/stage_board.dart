import 'package:flame/game.dart';
import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';
import '../flame/stage_board_game.dart';

/// Fits the whole stage course into the available space (画面が小さい場合
/// でもコース全体を1画面で確認できるようにする), scaling the tile size
/// down as needed while enforcing a minimum readable size.
class StageBoard extends StatefulWidget {
  const StageBoard({super.key, required this.controller});

  final GameController controller;

  @override
  State<StageBoard> createState() => _StageBoardState();
}

class _StageBoardState extends State<StageBoard> {
  StageBoardGame? _game;
  String? _gameStageId;

  static const double _minTileSize = 14;
  static const double _maxTileSize = 48;

  @override
  Widget build(BuildContext context) {
    final stage = widget.controller.stageDef;
    return LayoutBuilder(
      builder: (context, constraints) {
        final tileW = constraints.maxWidth / stage.width;
        final tileH = constraints.maxHeight / stage.height;
        final tileSize = tileW < tileH ? tileW : tileH;
        final clamped = tileSize.clamp(_minTileSize, _maxTileSize);

        if (_game == null || _gameStageId != stage.id) {
          _game = StageBoardGame(controller: widget.controller, tileSize: clamped);
          _gameStageId = stage.id;
        } else {
          _game!.updateTileSize(clamped);
        }

        return Center(
          child: SizedBox(
            width: clamped * stage.width,
            height: clamped * stage.height,
            child: GameWidget(game: _game!),
          ),
        );
      },
    );
  }
}
