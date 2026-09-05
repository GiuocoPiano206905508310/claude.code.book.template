import '../../domain/models/enemy.dart';
import 'game_balance.dart';

/// Master table of every enemy species, keyed by id. Add a new enemy by
/// adding an entry here, then reference its id from a stage's
/// `TileDefinition(kind: TileKind.enemy, enemyDefId: ...)`.
class EnemyMaster {
  const EnemyMaster._();

  static const Map<String, EnemyDefinition> byId = {
    'slime': EnemyDefinition(
      id: 'slime',
      name: 'スライム',
      maxHp: 8,
      attack: 1,
      defense: 1,
      expReward: GameBalance.normalEnemyExp,
      imageId: 'enemy_slime',
    ),
    'bat': EnemyDefinition(
      id: 'bat',
      name: 'コウモリ',
      maxHp: 7,
      attack: 2,
      defense: 1,
      expReward: GameBalance.normalEnemyExp,
      imageId: 'enemy_bat',
    ),
    'monster_box': EnemyDefinition(
      id: 'monster_box',
      name: 'モンスターボックス',
      maxHp: 9,
      attack: 1,
      defense: 2,
      expReward: GameBalance.normalEnemyExp,
      imageId: 'enemy_monster_box',
    ),
    'magic_book': EnemyDefinition(
      id: 'magic_book',
      name: '魔導書',
      maxHp: 12,
      attack: 1,
      defense: 1,
      expReward: GameBalance.normalEnemyExp,
      imageId: 'enemy_magic_book',
    ),
    'stone_statue': EnemyDefinition(
      id: 'stone_statue',
      name: '石像兵',
      maxHp: 20,
      attack: 2,
      defense: 3,
      expReward: GameBalance.bossEnemyExp,
      imageId: 'enemy_stone_statue',
      isBoss: true,
    ),
  };

  static EnemyDefinition byIdOrThrow(String id) {
    final enemy = byId[id];
    if (enemy == null) {
      throw ArgumentError('unknown enemy id: $id');
    }
    return enemy;
  }
}
