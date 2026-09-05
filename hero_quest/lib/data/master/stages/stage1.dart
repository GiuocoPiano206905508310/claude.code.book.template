import '../../../domain/models/position.dart';
import '../../../domain/models/stage.dart';
import '../../../domain/models/tile.dart';

/// ステージ1の固定マップ。
///
/// 縦一直線＋2つの分岐（開始直後の左右分岐）で構成し、ギミック3種
/// （一方通行・スイッチ&扉・ダメージ床）と、通常敵4種＋ボス1体、
/// 小宝箱2つ・中宝箱1つを配置する。
///
/// レイアウト（x: 0=左, 1=中央, 2=右 / y: 0=スタート, 下に進むほどゴールへ近づく）:
/// ```
/// y00        (1,0) start
/// y01        (1,1)
/// y02        (1,2) branch
/// y02-06 左: (0,2)-(0,6)  スライム, 小宝箱
/// y02-06 右: (2,2)-(2,6)  一方通行, コウモリ, 小宝箱
/// y06        (1,6) merge
/// y07        (1,7) switch
/// y08        (1,8) door
/// y09        (1,9) 中宝箱
/// y10        (1,10) モンスターボックス
/// y11        (1,11) 魔導書
/// y12        (1,12) ダメージ床
/// y13        (1,13) 石像兵(ボス)
/// y14        (1,14) goal
/// ```
StageDefinition buildStage1() {
  const switchA = 'stage1_switch_a';
  return StageDefinition(
    id: 'stage1',
    displayName: 'ステージ1：はじまりの道',
    startPosition: const Position(1, 0),
    goalPosition: const Position(1, 14),
    tiles: [
      const TileDefinition(
        position: Position(1, 0),
        connections: {Direction.down},
        kind: TileKind.start,
      ),
      const TileDefinition(
        position: Position(1, 1),
        connections: {Direction.up, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(1, 2),
        connections: {Direction.up, Direction.left, Direction.right},
        kind: TileKind.normal,
      ),

      // --- 左分岐: スライム + 小宝箱 ---
      const TileDefinition(
        position: Position(0, 2),
        connections: {Direction.right, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(0, 3),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'slime',
      ),
      const TileDefinition(
        position: Position(0, 4),
        connections: {Direction.up, Direction.down},
        kind: TileKind.chest,
        chestSize: ChestSize.small,
      ),
      const TileDefinition(
        position: Position(0, 5),
        connections: {Direction.up, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(0, 6),
        connections: {Direction.up, Direction.right},
        kind: TileKind.normal,
      ),

      // --- 右分岐: 一方通行 + コウモリ + 小宝箱 ---
      const TileDefinition(
        position: Position(2, 2),
        connections: {Direction.left, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(2, 3),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.oneWay,
        oneWayDirection: Direction.down,
      ),
      const TileDefinition(
        position: Position(2, 4),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'bat',
      ),
      const TileDefinition(
        position: Position(2, 5),
        connections: {Direction.up, Direction.down},
        kind: TileKind.chest,
        chestSize: ChestSize.small,
      ),
      const TileDefinition(
        position: Position(2, 6),
        connections: {Direction.up, Direction.left},
        kind: TileKind.normal,
      ),

      // --- 合流後: 共通ルート ---
      const TileDefinition(
        position: Position(1, 6),
        connections: {Direction.left, Direction.right, Direction.down},
        kind: TileKind.normal,
      ),
      const TileDefinition(
        position: Position(1, 7),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.switchTile,
        switchId: switchA,
      ),
      const TileDefinition(
        position: Position(1, 8),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.doorTile,
        switchId: switchA,
      ),
      const TileDefinition(
        position: Position(1, 9),
        connections: {Direction.up, Direction.down},
        kind: TileKind.chest,
        chestSize: ChestSize.medium,
      ),
      const TileDefinition(
        position: Position(1, 10),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'monster_box',
      ),
      const TileDefinition(
        position: Position(1, 11),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'magic_book',
      ),
      const TileDefinition(
        position: Position(1, 12),
        connections: {Direction.up, Direction.down},
        kind: TileKind.gimmick,
        gimmickType: GimmickType.damageFloor,
      ),
      const TileDefinition(
        position: Position(1, 13),
        connections: {Direction.up, Direction.down},
        kind: TileKind.enemy,
        enemyDefId: 'stone_statue',
      ),
      const TileDefinition(
        position: Position(1, 14),
        connections: {Direction.up},
        kind: TileKind.goal,
      ),
    ],
  );
}
