import '../../data/master/game_balance.dart';
import '../models/stage.dart';
import '../models/tile.dart';

/// Side effects produced when the hero steps onto a gimmick tile.
class GimmickEffect {
  final StageState? updatedStageState;
  final int damage;

  const GimmickEffect({this.updatedStageState, this.damage = 0});

  static const GimmickEffect none = GimmickEffect();
}

/// Common interface every gimmick implements. New gimmicks are added by
/// implementing this and registering an instance in
/// [GimmickService._handlers] against a new [GimmickType] — no other
/// game code needs to change.
abstract class GimmickHandler {
  GimmickEffect onEnter(TileDefinition tile, StageState stageState);
}

/// 一方通行マス: 進行方向の制限は `MovementService` が担当するため、
/// タイルに入った時点での追加効果は無い。
class OneWayGimmickHandler implements GimmickHandler {
  const OneWayGimmickHandler();

  @override
  GimmickEffect onEnter(TileDefinition tile, StageState stageState) =>
      GimmickEffect.none;
}

/// スイッチマス: 通過した瞬間に対応する扉を開く（対応する扉IDのスイッチ
/// 状態をtrueにする。扉タイル自体は、このスイッチが起動済みかどうかを
/// `MovementService` が都度チェックすることで開閉を表現する）。
class SwitchGimmickHandler implements GimmickHandler {
  const SwitchGimmickHandler();

  @override
  GimmickEffect onEnter(TileDefinition tile, StageState stageState) {
    final switchId = tile.switchId;
    if (switchId == null) return GimmickEffect.none;
    return GimmickEffect(
      updatedStageState: stageState.withSwitchTriggered(switchId),
    );
  }
}

/// 扉マス: 開閉判定は移動可否チェック側で行うため、入った時点での追加
/// 効果は無い。
class DoorGimmickHandler implements GimmickHandler {
  const DoorGimmickHandler();

  @override
  GimmickEffect onEnter(TileDefinition tile, StageState stageState) =>
      GimmickEffect.none;
}

/// ダメージ床: 止まると1回だけダメージを与える。
class DamageFloorGimmickHandler implements GimmickHandler {
  const DamageFloorGimmickHandler();

  @override
  GimmickEffect onEnter(TileDefinition tile, StageState stageState) {
    final tileState = stageState.tileStateAt(tile.position);
    if (tileState.damageFloorTriggered) return GimmickEffect.none;

    final damage = tile.damageFloorAmount ?? GameBalance.defaultDamageFloorAmount;
    final updated = stageState.withTileState(
      tile.position,
      tileState.copyWith(damageFloorTriggered: true),
    );
    return GimmickEffect(updatedStageState: updated, damage: damage);
  }
}

/// Dispatches an entered gimmick tile to its [GimmickHandler].
class GimmickService {
  static const Map<GimmickType, GimmickHandler> _handlers = {
    GimmickType.oneWay: OneWayGimmickHandler(),
    GimmickType.switchTile: SwitchGimmickHandler(),
    GimmickType.doorTile: DoorGimmickHandler(),
    GimmickType.damageFloor: DamageFloorGimmickHandler(),
  };

  const GimmickService();

  GimmickEffect handleEnter(TileDefinition tile, StageState stageState) {
    final handler = _handlers[tile.gimmickType];
    if (handler == null) return GimmickEffect.none;
    return handler.onEnter(tile, stageState);
  }
}
