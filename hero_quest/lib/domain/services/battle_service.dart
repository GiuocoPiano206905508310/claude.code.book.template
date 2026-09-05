import 'dart:math';

import '../../data/master/game_balance.dart';
import '../models/battle_state.dart';
import '../models/enemy.dart';
import '../models/hero_state.dart';

/// Turn-based, fully-automatic-resolution battle rules.
///
/// The service is pure: every method takes the current state plus the
/// hero's *current* stats (already including any heal/fruit effect the
/// caller applied earlier in the same turn) and returns a new
/// [BattleState]. It never touches [HeroState] directly — the caller is
/// responsible for reading `battle.heroHp` back into the hero after each
/// turn, and for removing any item that got consumed (detectable by
/// diffing `weaponUsedThisBattle`/`shieldUsedThisBattle` before and after
/// the call).
class BattleService {
  const BattleService();

  /// [minDamage] defaults to `GameBalance.minimumDamage` but can be
  /// overridden — the spec calls for the minimum-damage floor itself to be
  /// a configurable setting (0 disables it entirely).
  static int calcDamage(
    int attack,
    int defense, {
    int minDamage = GameBalance.minimumDamage,
  }) => max(minDamage, attack - defense);

  /// Starts a battle and immediately resolves turn 1 (auto hero attack,
  /// then enemy counter-attack if it survives), per spec.
  BattleState startBattle({
    required HeroState hero,
    required EnemyDefinition enemyDef,
    String? autoShieldItemId,
    int autoShieldBonus = 0,
  }) {
    final initial = BattleState(
      enemyDefId: enemyDef.id,
      enemyName: enemyDef.name,
      enemyAttack: enemyDef.attack,
      enemyDefense: enemyDef.defense,
      heroMaxHp: hero.baseMaxHp,
      heroHp: hero.currentHp,
      enemyMaxHp: enemyDef.maxHp,
      enemyHp: enemyDef.maxHp,
      turn: 1,
      tempAttackBonus: 0,
      tempDefenseBonus: 0,
      weaponUsedThisBattle: false,
      shieldUsedThisBattle: false,
      hasTakenDamageThisBattle: false,
      log: [BattleLogEntry('${enemyDef.name}が現れた！')],
      outcome: BattleOutcome.ongoing,
      expReward: enemyDef.expReward,
      isBoss: enemyDef.isBoss,
    );
    return _resolveExchange(
      battle: initial,
      heroBaseAttack: hero.baseAttack,
      heroBaseDefense: hero.baseDefense,
      autoShieldItemId: autoShieldItemId,
      autoShieldBonus: autoShieldBonus,
    );
  }

  /// Resolves turn 2+: optionally activates a weapon first (if
  /// [weaponItemId] is given and no weapon has been used yet this
  /// battle), then runs the same attack/counter-attack exchange as
  /// [startBattle]. Heal potions and fruits are applied by the caller
  /// *before* calling this, by updating [heroBaseAttack]/[heroBaseDefense]
  /// and the hero's HP that flows into `battle.heroHp` — this method only
  /// needs the resulting numbers.
  BattleState continueTurn({
    required BattleState battle,
    required int heroBaseAttack,
    required int heroBaseDefense,
    required int heroHpBeforeTurn,
    String? weaponItemId,
    int weaponBonus = 0,
    String? autoShieldItemId,
    int autoShieldBonus = 0,
  }) {
    assert(battle.outcome == BattleOutcome.ongoing);
    var working = battle.copyWith(heroHp: heroHpBeforeTurn);

    if (weaponItemId != null && !working.weaponUsedThisBattle) {
      working = working.copyWith(
        tempAttackBonus: working.tempAttackBonus + weaponBonus,
        weaponUsedThisBattle: true,
        log: [
          ...working.log,
          BattleLogEntry('武器を使った！ 攻撃力+$weaponBonus'),
        ],
      );
    }

    return _resolveExchange(
      battle: working,
      heroBaseAttack: heroBaseAttack,
      heroBaseDefense: heroBaseDefense,
      autoShieldItemId: autoShieldItemId,
      autoShieldBonus: autoShieldBonus,
    );
  }

  BattleState _resolveExchange({
    required BattleState battle,
    required int heroBaseAttack,
    required int heroBaseDefense,
    String? autoShieldItemId,
    int autoShieldBonus = 0,
  }) {
    var state = battle;
    final log = [...state.log];

    // 1. 勇者の攻撃。
    final heroAttack = heroBaseAttack + state.tempAttackBonus;
    final damageToEnemy = calcDamage(heroAttack, state.enemyDefense);
    final enemyHp = max(0, state.enemyHp - damageToEnemy);
    log.add(
      BattleLogEntry('勇者の攻撃！ ${state.enemyName}に$damageToEnemyダメージ（残りHP $enemyHp）'),
    );
    state = state.copyWith(enemyHp: enemyHp, log: log);

    if (enemyHp <= 0) {
      log.add(BattleLogEntry('${state.enemyName}を倒した！'));
      return state.copyWith(log: log, outcome: BattleOutcome.victory);
    }

    // 2. 盾の自動発動（このバトルで初めてダメージを受ける直前）。
    if (!state.hasTakenDamageThisBattle &&
        !state.shieldUsedThisBattle &&
        autoShieldItemId != null) {
      state = state.copyWith(
        tempDefenseBonus: state.tempDefenseBonus + autoShieldBonus,
        shieldUsedThisBattle: true,
        log: [...log, BattleLogEntry('盾が自動発動した！ 防御力+$autoShieldBonus')],
      );
    }

    // 3. 敵の反撃。
    final heroDefense = heroBaseDefense + state.tempDefenseBonus;
    final damageToHero = calcDamage(state.enemyAttack, heroDefense);
    final heroHp = max(0, state.heroHp - damageToHero);
    final finalLog = [
      ...state.log,
      BattleLogEntry('${state.enemyName}の反撃！ 勇者に$damageToHeroダメージ（残りHP $heroHp）'),
    ];
    state = state.copyWith(
      heroHp: heroHp,
      hasTakenDamageThisBattle: true,
      log: finalLog,
    );

    if (heroHp <= 0) {
      return state.copyWith(
        log: [...finalLog, const BattleLogEntry('勇者は倒れてしまった…')],
        outcome: BattleOutcome.defeat,
      );
    }

    return state.copyWith(turn: state.turn + 1);
  }
}
