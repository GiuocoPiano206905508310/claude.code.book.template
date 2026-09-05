/// Outcome of a battle in progress.
enum BattleOutcome { ongoing, victory, defeat }

/// One line of the battle log, shown to the player one turn at a time.
class BattleLogEntry {
  final String message;

  const BattleLogEntry(this.message);
}

/// Transient state of an in-progress battle. Never persisted directly:
/// per spec, saving is only allowed just before a battle starts or after
/// it ends, so a save always finds this at rest (null on the controller).
class BattleState {
  final String enemyDefId;
  final String enemyName;
  final int enemyAttack;
  final int enemyDefense;

  final int heroMaxHp;
  final int heroHp;
  final int enemyMaxHp;
  final int enemyHp;

  final int turn;

  /// Temporary, battle-only bonuses from a used weapon/shield. Kept
  /// separate from the hero's base stats, which are never touched by
  /// battle items.
  final int tempAttackBonus;
  final int tempDefenseBonus;

  final bool weaponUsedThisBattle;
  final bool shieldUsedThisBattle;

  /// Whether the hero has taken damage yet this battle. Used to decide
  /// whether the shield should auto-trigger before the next hit.
  final bool hasTakenDamageThisBattle;

  final List<BattleLogEntry> log;
  final BattleOutcome outcome;
  final int expReward;
  final bool isBoss;

  const BattleState({
    required this.enemyDefId,
    required this.enemyName,
    required this.enemyAttack,
    required this.enemyDefense,
    required this.heroMaxHp,
    required this.heroHp,
    required this.enemyMaxHp,
    required this.enemyHp,
    required this.turn,
    required this.tempAttackBonus,
    required this.tempDefenseBonus,
    required this.weaponUsedThisBattle,
    required this.shieldUsedThisBattle,
    required this.hasTakenDamageThisBattle,
    required this.log,
    required this.outcome,
    required this.expReward,
    required this.isBoss,
  });

  BattleState copyWith({
    int? heroHp,
    int? enemyHp,
    int? turn,
    int? tempAttackBonus,
    int? tempDefenseBonus,
    bool? weaponUsedThisBattle,
    bool? shieldUsedThisBattle,
    bool? hasTakenDamageThisBattle,
    List<BattleLogEntry>? log,
    BattleOutcome? outcome,
  }) {
    return BattleState(
      enemyDefId: enemyDefId,
      enemyName: enemyName,
      enemyAttack: enemyAttack,
      enemyDefense: enemyDefense,
      heroMaxHp: heroMaxHp,
      heroHp: heroHp ?? this.heroHp,
      enemyMaxHp: enemyMaxHp,
      enemyHp: enemyHp ?? this.enemyHp,
      turn: turn ?? this.turn,
      tempAttackBonus: tempAttackBonus ?? this.tempAttackBonus,
      tempDefenseBonus: tempDefenseBonus ?? this.tempDefenseBonus,
      weaponUsedThisBattle: weaponUsedThisBattle ?? this.weaponUsedThisBattle,
      shieldUsedThisBattle: shieldUsedThisBattle ?? this.shieldUsedThisBattle,
      hasTakenDamageThisBattle:
          hasTakenDamageThisBattle ?? this.hasTakenDamageThisBattle,
      log: log ?? this.log,
      outcome: outcome ?? this.outcome,
      expReward: expReward,
      isBoss: isBoss,
    );
  }
}
