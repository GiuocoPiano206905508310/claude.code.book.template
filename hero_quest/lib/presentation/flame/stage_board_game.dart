import 'package:flame/components.dart';
import 'package:flame/game.dart';

import '../../domain/game_controller.dart';
import '../../domain/models/position.dart';
import 'hero_component.dart';
import 'tile_visual.dart';

/// Renders the whole stage course in a single screen: every tile plus the
/// hero. Listens to [GameController] and keeps the board in sync whenever
/// the hero moves, an enemy is defeated, a chest is opened or a door
/// gimmick's switch is triggered.
class StageBoardGame extends FlameGame {
  StageBoardGame({
    required this.controller,
    required double tileSize,
  }) : _tileSize = tileSize;

  final GameController controller;
  double _tileSize;
  double get tileSize => _tileSize;

  final Map<String, TileVisual> _tileVisuals = {};
  HeroComponent? _hero;
  String? _builtForStageId;
  Position? _lastHeroPosition;

  @override
  Future<void> onLoad() async {
    camera.viewfinder.anchor = Anchor.topLeft;
    await _buildBoard();
    controller.addListener(_onControllerChanged);
  }

  @override
  void onRemove() {
    controller.removeListener(_onControllerChanged);
    super.onRemove();
  }

  Future<void> _buildBoard() async {
    world.removeAll(world.children.toList());
    _tileVisuals.clear();

    for (final tile in controller.stageDef.tiles) {
      final visual = TileVisual(tile: tile, tileSize: _tileSize)
        ..position = Vector2(tile.position.x * _tileSize, tile.position.y * _tileSize);
      world.add(visual);
      _tileVisuals[tile.position.key] = visual;
    }

    final hero = HeroComponent(tileSize: _tileSize);
    world.add(hero);
    _hero = hero;
    _builtForStageId = controller.stageDef.id;
    _lastHeroPosition = controller.stageState.heroPosition;
    await hero.moveTo(_topLeft(controller.stageState.heroPosition), Direction.down, animate: false);

    await _refreshAllTiles();
  }

  Vector2 _topLeft(Position p) => Vector2(p.x * _tileSize, p.y * _tileSize);

  Future<void> _refreshAllTiles() async {
    for (final tile in controller.stageDef.tiles) {
      await _tileVisuals[tile.position.key]?.refresh(controller.stageState);
    }
  }

  void _onControllerChanged() {
    if (_builtForStageId != controller.stageDef.id) {
      _buildBoard();
      return;
    }

    final newPosition = controller.stageState.heroPosition;
    if (_hero != null && newPosition != _lastHeroPosition) {
      final direction = _directionBetween(_lastHeroPosition, newPosition);
      _hero!.moveTo(_topLeft(newPosition), direction);
      _lastHeroPosition = newPosition;
    }
    _refreshAllTiles();
  }

  Direction _directionBetween(Position? from, Position to) {
    if (from == null) return Direction.down;
    if (to.y < from.y) return Direction.up;
    if (to.y > from.y) return Direction.down;
    if (to.x < from.x) return Direction.left;
    return Direction.right;
  }

  /// Called by the wrapping widget when available screen space changes
  /// (e.g. after a `LayoutBuilder` recomputes the tile size).
  void updateTileSize(double newTileSize) {
    if ((newTileSize - _tileSize).abs() < 0.5) return;
    _tileSize = newTileSize;
    for (final tile in controller.stageDef.tiles) {
      final visual = _tileVisuals[tile.position.key];
      visual?.position = Vector2(tile.position.x * _tileSize, tile.position.y * _tileSize);
      visual?.applyTileSize(_tileSize);
    }
    _hero?.applyTileSize(_tileSize);
    if (_lastHeroPosition != null) {
      _hero?.snapTo(_topLeft(_lastHeroPosition!));
    }
  }
}
