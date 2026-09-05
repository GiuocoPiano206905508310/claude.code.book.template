import '../../data/master/game_balance.dart';
import '../models/hero_state.dart';

/// Result of granting experience: the updated hero and how many levels
/// were gained (0 if not enough exp for even one level).
class LevelUpResult {
  final HeroState hero;
  final int levelsGained;

  const LevelUpResult(this.hero, this.levelsGained);
}

/// Experience and level-up rules (仮設定 — see `GameBalance` for the
/// tunable numbers this reads).
class LevelService {
  const LevelService();

  LevelUpResult grantExp(HeroState hero, int exp) {
    var currentExp = hero.exp + exp;
    var level = hero.level;
    var maxHp = hero.baseMaxHp;
    var attack = hero.baseAttack;
    var defense = hero.baseDefense;
    var currentHp = hero.currentHp;
    var levelsGained = 0;

    while (level < GameBalance.levelCap) {
      final needed = GameBalance.expToNextLevel(level);
      if (currentExp < needed) break;

      currentExp -= needed;
      level += 1;
      levelsGained += 1;

      maxHp += GameBalance.hpGainPerLevel;
      currentHp += GameBalance.hpGainPerLevel;
      attack += GameBalance.attackGainPerLevel;
      if (level.isEven) {
        defense += GameBalance.defenseGainOnEvenLevel;
      }
    }

    final newHero = hero.copyWith(
      level: level,
      exp: currentExp,
      baseMaxHp: maxHp,
      baseAttack: attack,
      baseDefense: defense,
      currentHp: currentHp.clamp(0, maxHp),
    );
    return LevelUpResult(newHero, levelsGained);
  }
}
