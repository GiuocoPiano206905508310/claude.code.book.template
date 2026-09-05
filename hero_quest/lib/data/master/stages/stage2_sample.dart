import '../../../domain/models/position.dart';
import '../../../domain/models/stage.dart';
import '../../../domain/models/tile.dart';

/// ステージ2のサンプルデータ。
///
/// ステージ1よりコース形状を変え、ギミックの密度を上げたサンプル
/// （ダメージ床×2、一方通行×1、スイッチ&扉×1）。敵マスターデータは
/// ステージ1と共用しているが、コース構造そのものはデータ追加のみで
/// 変更できることを示す目的のサンプルであり、専用の敵・アイテムを
/// 追加すればさらに難易度を上げられる。
StageDefinition buildStage2Sample() {
  const switchB = 'stage2_switch_b';
  return StageDefinition(
    id: 'stage2_sample',
    displayName: 'ステージ2（サンプル）：試練の道',
    startPosition: const Position(1, 0),
    goalPosition: const Position(1, 9),
    tiles: [
      const TileDefinition(
        position: Position(1, 0),
        connections: {Direction.down},
        kind: TileKind.start,
      ),
      const TileDefinition(
        position: Position(1, 1),
        connections: {Direction.up, Direction.left, Direction.right},
        kind: TileKind.normal,
      ),

      // --- 左分岐: ダメージ床 + コウモリ ---
      const TileDefinition(
        position: Position(0, 1),
        connections: {Direction.right, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(0, 2),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.damageFloor,
      ),
      const TileDefinition(
        position: Position(0, 3),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'bat',
      ),
      const TileDefinition(
        position: Position(0, 4),
        connections: {Direction.up, Direction.right},
        kind: TileKind.normal,
      ),

      // --- 右分岐: 一方通行 + モンスターボックス ---
      const TileDefinition(
        position: Position(2, 1),
        connections: {Direction.left, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(2, 2),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.oneWay,
        oneWayDirection: Direction.down,
      ),
      const TileDefinition(
        position: Position(2, 3),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'monster_box',
      ),
      const TileDefinition(
        position: Position(2, 4),
        connections: {Direction.up, Direction.left},
        kind: TileKind.normal,
      ),

      // --- 合流後: 共通ルート ---
      const TileDefinition(
        position: Position(1, 4),
        connections: {Direction.left, Direction.right, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(1, 5),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.switchTile,
        switchId: switchB,
      ),
      const TileDefinition(
        position: Position(1, 6),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.doorTile,
        switchId: switchB,
      ),
      const TileDefinition(
        position: Position(1, 7),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.damageFloor,
      ),
      const TileDefinition(
        position: Position(1, 8),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'stone_statue',
      ),
      const TileDefinition(
        position: Position(1, 9),
        connections: {Direction.up},
        kind: TileKind.goal,
      ),
    ],
  );
}
