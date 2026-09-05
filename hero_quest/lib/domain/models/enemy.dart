/// Master data for one kind of enemy (species). Referenced by id from
/// [TileDefinition.enemyDefId].
class EnemyDefinition {
  final String id;
  final String name;
  final int maxHp;
  final int attack;
  final int defense;
  final int expReward;
  final String imageId;
  final bool isBoss;

  const EnemyDefinition({
    required this.id,
    required this.name,
    required this.maxHp,
    required this.attack,
    required this.defense,
    required this.expReward,
    required this.imageId,
    this.isBoss = false,
  });
}

/// Per-tile runtime state of an enemy placed on the map. HP during an
/// ongoing fight lives in [BattleState]; this only tracks whether the
/// enemy has been permanently removed from the map.
class EnemyState {
  final String enemyDefId;
  final bool defeated;

  const EnemyState({required this.enemyDefId, this.defeated = false});

  EnemyState copyWith({bool? defeated}) =>
      EnemyState(enemyDefId: enemyDefId, defeated: defeated ?? this.defeated);

  Map<String, dynamic> toJson() => {
    'enemyDefId': enemyDefId,
    'defeated': defeated,
  };

  factory EnemyState.fromJson(Map<String, dynamic> json) => EnemyState(
    enemyDefId: json['enemyDefId'] as String,
    defeated: json['defeated'] as bool,
  );
}
