import 'package:flutter_test/flutter_test.dart';
import 'package:hero_quest/data/master/items.dart';
import 'package:hero_quest/domain/models/hero_state.dart';
import 'package:hero_quest/domain/models/item.dart';
import 'package:hero_quest/domain/services/item_effect_service.dart';
import 'package:hero_quest/domain/services/random_service.dart';

void main() {
  const service = ItemEffectService();

  test('回復薬は最大HPを超えて回復しない', () {
    final hero = HeroState.initial().copyWith(currentHp: 9); // maxHp 10
    final healed = service.useHealPotion(hero, ItemMaster.byIdOrThrow('heal_potion_l')); // +10
    expect(healed.currentHp, hero.baseMaxHp);
  });

  test('実は基礎能力を設定範囲内でランダムに上昇させる', () {
    final hero = HeroState.initial();
    final random = RandomService(seed: 1);
    final result = service.useFruit(hero, ItemMaster.byIdOrThrow('fruit_attack'), random);
    expect(result.amountGained, inInclusiveRange(1, 3));
    expect(result.hero.baseAttack, hero.baseAttack + result.amountGained);
  });

  test('所持枠は3つを超えない。空きが無ければ自動格納できない', () {
    var hero = HeroState.initial();
    expect(hero.inventory.length, 3);

    hero = service.tryAutoStore(hero, 'heal_potion_s')!;
    hero = service.tryAutoStore(hero, 'heal_potion_m')!;
    hero = service.tryAutoStore(hero, 'shield_wood')!;
    expect(hero.hasEmptySlot, isFalse);

    final result = service.tryAutoStore(hero, 'weapon_club');
    expect(result, isNull);
    expect(hero.inventory.length, 3);
  });

  test('入れ替えで指定枠のアイテムが新アイテムに置き換わる', () {
    var hero = HeroState.initial();
    hero = service.tryAutoStore(hero, 'heal_potion_s')!;
    hero = service.tryAutoStore(hero, 'heal_potion_m')!;
    hero = service.tryAutoStore(hero, 'shield_wood')!;

    hero = service.swapInto(hero, 1, 'weapon_club');

    expect(hero.inventory[1], const InventoryItem('weapon_club'));
    expect(hero.inventory[0], const InventoryItem('heal_potion_s'));
    expect(hero.inventory[2], const InventoryItem('shield_wood'));
  });

  test('使用したアイテムは消える', () {
    var hero = HeroState.initial();
    hero = service.tryAutoStore(hero, 'heal_potion_s')!;
    expect(hero.inventory[0], isNotNull);

    hero = service.removeFromSlot(hero, 0);
    expect(hero.inventory[0], isNull);
  });
}
