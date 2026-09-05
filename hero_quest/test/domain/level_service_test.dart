import 'package:flutter_test/flutter_test.dart';
import 'package:hero_quest/data/master/game_balance.dart';
import 'package:hero_quest/domain/models/hero_state.dart';
import 'package:hero_quest/domain/services/level_service.dart';

void main() {
  const service = LevelService();

  test('必要経験値ちょうどでレベルアップし、能力が既定どおり上昇する', () {
    final hero = HeroState.initial(); // level 1, exp 0
    final needed = GameBalance.expToNextLevel(1); // 10

    final result = service.grantExp(hero, needed);

    expect(result.levelsGained, 1);
    expect(result.hero.level, 2);
    expect(result.hero.exp, 0);
    expect(result.hero.baseMaxHp, hero.baseMaxHp + GameBalance.hpGainPerLevel);
    expect(result.hero.baseAttack, hero.baseAttack + GameBalance.attackGainPerLevel);
    // レベル2 (偶数) なので防御力も上昇する。
    expect(result.hero.baseDefense, hero.baseDefense + GameBalance.defenseGainOnEvenLevel);
    // 増えた最大HP分だけ現在HPも回復する。
    expect(result.hero.currentHp, hero.currentHp + GameBalance.hpGainPerLevel);
  });

  test('奇数レベル到達時は防御力が上昇しない', () {
    final hero = HeroState.initial();
    final expForLevel2 = GameBalance.expToNextLevel(1);
    final expForLevel3 = GameBalance.expToNextLevel(2);

    final afterLevel2 = service.grantExp(hero, expForLevel2).hero;
    final afterLevel3 = service.grantExp(afterLevel2, expForLevel3).hero;

    expect(afterLevel3.level, 3);
    expect(afterLevel3.baseDefense, afterLevel2.baseDefense);
  });

  test('大量の経験値で複数レベル同時に上昇できる', () {
    final hero = HeroState.initial();
    final result = service.grantExp(hero, 1000);
    expect(result.levelsGained, greaterThan(1));
    expect(result.hero.level, lessThanOrEqualTo(GameBalance.levelCap));
  });
}
