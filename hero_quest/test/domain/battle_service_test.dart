import 'package:flutter_test/flutter_test.dart';
import 'package:hero_quest/domain/models/battle_state.dart';
import 'package:hero_quest/domain/models/enemy.dart';
import 'package:hero_quest/domain/models/hero_state.dart';
import 'package:hero_quest/domain/services/battle_service.dart';

void main() {
  const service = BattleService();

  group('calcDamage', () {
    test('5対1で4ダメージになる', () {
      expect(BattleService.calcDamage(5, 1), 4);
    });

    test('攻撃力が防御力以下でも最低ダメージ(既定1)が保証される', () {
      expect(BattleService.calcDamage(1, 10), 1);
    });

    test('最低ダメージを0に設定すると0ダメージも許容される', () {
      expect(BattleService.calcDamage(1, 10, minDamage: 0), 0);
    });
  });

  group('startBattle', () {
    test('勇者が先手で敵を倒した場合、敵は反撃しない', () {
      final hero = HeroState.initial().copyWith(baseAttack: 99);
      const enemy = EnemyDefinition(
        id: 'slime',
        name: 'スライム',
        maxHp: 8,
        attack: 5,
        defense: 1,
        expReward: 3,
        imageId: 'enemy_slime',
      );

      final battle = service.startBattle(hero: hero, enemyDef: enemy);

      expect(battle.outcome, BattleOutcome.victory);
      expect(battle.heroHp, hero.currentHp);
      expect(battle.hasTakenDamageThisBattle, isFalse);
      expect(battle.log.any((e) => e.message.contains('反撃')), isFalse);
    });

    test('盾を所持していると最初の被ダメージ直前に自動発動する', () {
      final hero = HeroState.initial().copyWith(baseAttack: 1, baseDefense: 0);
      const enemy = EnemyDefinition(
        id: 'bat',
        name: 'コウモリ',
        maxHp: 100,
        attack: 5,
        defense: 100,
        expReward: 3,
        imageId: 'enemy_bat',
      );

      final withoutShield = service.startBattle(hero: hero, enemyDef: enemy);
      final withShield = service.startBattle(
        hero: hero,
        enemyDef: enemy,
        autoShieldItemId: 'shield_iron',
        autoShieldBonus: 2,
      );

      expect(withShield.shieldUsedThisBattle, isTrue);
      expect(withShield.tempDefenseBonus, 2);
      // 防御力+2の分だけ被ダメージが小さくなる。
      expect(withShield.heroHp, greaterThan(withoutShield.heroHp));
    });
  });

  group('continueTurn', () {
    late HeroState hero;
    late EnemyDefinition enemy;

    setUp(() {
      hero = HeroState.initial().copyWith(baseAttack: 1, baseDefense: 1);
      enemy = const EnemyDefinition(
        id: 'stone_statue',
        name: '石像兵',
        maxHp: 1000,
        attack: 1,
        defense: 1,
        expReward: 10,
        imageId: 'enemy_stone_statue',
        isBoss: true,
      );
    });

    test('1戦闘中に武器を複数回発動できない', () {
      var battle = service.startBattle(hero: hero, enemyDef: enemy);
      expect(battle.outcome, BattleOutcome.ongoing);

      battle = service.continueTurn(
        battle: battle,
        heroBaseAttack: hero.baseAttack,
        heroBaseDefense: hero.baseDefense,
        heroHpBeforeTurn: battle.heroHp,
        weaponItemId: 'weapon_club',
        weaponBonus: 2,
      );
      expect(battle.tempAttackBonus, 2);
      expect(battle.weaponUsedThisBattle, isTrue);

      battle = service.continueTurn(
        battle: battle,
        heroBaseAttack: hero.baseAttack,
        heroBaseDefense: hero.baseDefense,
        heroHpBeforeTurn: battle.heroHp,
        weaponItemId: 'weapon_iron_hammer',
        weaponBonus: 3,
      );
      // 2つ目の武器は発動しないので、加算されない。
      expect(battle.tempAttackBonus, 2);
    });

    test('1戦闘中に盾を複数回自動発動できない', () {
      var battle = service.startBattle(
        hero: hero,
        enemyDef: enemy,
        autoShieldItemId: 'shield_iron',
        autoShieldBonus: 2,
      );
      expect(battle.shieldUsedThisBattle, isTrue);
      final bonusAfterFirst = battle.tempDefenseBonus;

      battle = service.continueTurn(
        battle: battle,
        heroBaseAttack: hero.baseAttack,
        heroBaseDefense: hero.baseDefense,
        heroHpBeforeTurn: battle.heroHp,
        autoShieldItemId: 'shield_gold',
        autoShieldBonus: 5,
      );
      expect(battle.tempDefenseBonus, bonusAfterFirst);
    });
  });
}
