import 'dart:math' as math;

import 'package:flame/components.dart';

import '../../domain/models/position.dart';
import '../../domain/models/stage.dart';
import '../../domain/models/tile.dart';
import 'pixel_paint.dart';

/// Renders one map tile: a floor/background sprite (chosen from the tile's
/// static kind/gimmick) plus an optional "occupant" sprite on top (an
/// enemy, an unopened/opened chest) whose choice depends on mutable
/// [StageState] and is refreshed via [refresh].
class TileVisual extends PositionComponent {
  TileVisual({required this.tile, required double tileSize})
    : super(size: Vector2.all(tileSize));

  final TileDefinition tile;

  late final SpriteComponent _background;
  SpriteComponent? _occupant;
  String? _occupantImageId;

  @override
  Future<void> onLoad() async {
    _background = SpriteComponent(
      sprite: await Sprite.load(_backgroundImageId()),
      size: size,
      paint: pixelPaint(),
    );
    if (tile.kind == TileKind.gimmick && tile.gimmickType == GimmickType.oneWay) {
      _background.angle = _oneWayAngle();
    }
    add(_background);
  }

  void applyTileSize(double tileSize) {
    size = Vector2.all(tileSize);
    _background.size = size;
    _occupant?.size = size * 0.7;
    _occupant?.position = size * 0.15;
  }

  String _backgroundImageId() {
    switch (tile.kind) {
      case TileKind.start:
        return 'tile_start.png';
      case TileKind.goal:
        return 'tile_goal.png';
      case TileKind.gimmick:
        switch (tile.gimmickType!) {
          case GimmickType.oneWay:
            return 'tile_gimmick_oneway.png';
          case GimmickType.switchTile:
            return 'tile_gimmick_switch.png';
          case GimmickType.doorTile:
            return 'tile_gimmick_door_closed.png';
          case GimmickType.damageFloor:
            return 'tile_gimmick_damagefloor.png';
        }
      case TileKind.enemy:
      case TileKind.chest:
      case TileKind.normal:
        return 'tile_floor.png';
    }
  }

  double _oneWayAngle() {
    switch (tile.oneWayDirection!) {
      case Direction.right:
        return 0;
      case Direction.down:
        return math.pi / 2;
      case Direction.left:
        return math.pi;
      case Direction.up:
        return -math.pi / 2;
    }
  }

  Future<void> refresh(StageState state) async {
    if (tile.kind == TileKind.gimmick && tile.gimmickType == GimmickType.doorTile) {
      final open = tile.switchId != null && state.isSwitchTriggered(tile.switchId!);
      final img = open ? 'tile_gimmick_door_open.png' : 'tile_gimmick_door_closed.png';
      _background.sprite = await Sprite.load(img);
    }

    final occupantId = _resolveOccupantImageId(state);
    if (occupantId == _occupantImageId) return;
    _occupantImageId = occupantId;

    if (occupantId == null) {
      _occupant?.removeFromParent();
      _occupant = null;
      return;
    }

    final sprite = await Sprite.load(occupantId);
    if (_occupant == null) {
      _occupant = SpriteComponent(
        sprite: sprite,
        size: size * 0.7,
        position: size * 0.15,
        priority: 1,
        paint: pixelPaint(),
      );
      add(_occupant!);
    } else {
      _occupant!.sprite = sprite;
    }
  }

  String? _resolveOccupantImageId(StageState state) {
    switch (tile.kind) {
      case TileKind.enemy:
        final entry = state.enemyStates[tile.position.key];
        if (entry == null || entry.defeated) return null;
        return 'enemy_${entry.enemyDefId}.png';
      case TileKind.chest:
        final tileState = state.tileStateAt(tile.position);
        if (tileState.chestOpened) return 'tile_chest_opened.png';
        return 'tile_chest_${tile.chestSize!.name}.png';
      default:
        return null;
    }
  }
}
