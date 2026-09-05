import 'package:flame/components.dart';
import 'package:flame/effects.dart';

import '../../domain/models/position.dart';
import 'pixel_paint.dart';

/// The hero sprite. Shows a direction-specific placeholder and slides
/// (rather than teleports) to its new tile on every logical move, purely
/// as a visual touch — the underlying position is still updated one tile
/// at a time per input, matching the "1回の入力で1マスだけ移動する"
/// requirement.
class HeroComponent extends PositionComponent {
  HeroComponent({required double tileSize}) : super(size: Vector2.all(tileSize));

  late SpriteComponent _sprite;
  Direction _facing = Direction.down;

  @override
  int get priority => 10;

  @override
  Future<void> onLoad() async {
    _sprite = SpriteComponent(
      sprite: await Sprite.load('hero_down.png'),
      size: size,
      paint: pixelPaint(),
    );
    add(_sprite);
  }

  void applyTileSize(double tileSize) {
    size = Vector2.all(tileSize);
    _sprite.size = size;
  }

  /// Repositions instantly without changing the facing sprite — used when
  /// the board is rescaled, not when the hero actually moves.
  void snapTo(Vector2 topLeft) {
    removeWhere((c) => c is MoveToEffect);
    position = topLeft;
  }

  Future<void> moveTo(Vector2 topLeft, Direction direction, {bool animate = true}) async {
    if (direction != _facing) {
      _facing = direction;
      _sprite.sprite = await Sprite.load('hero_${direction.name}.png');
    }
    removeWhere((c) => c is MoveToEffect);
    if (animate) {
      add(MoveToEffect(topLeft, EffectController(duration: 0.15)));
    } else {
      position = topLeft;
    }
  }
}
