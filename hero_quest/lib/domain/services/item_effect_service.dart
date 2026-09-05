import '../models/hero_state.dart';
import '../models/item.dart';
import 'random_service.dart';

/// Result of consuming a fruit item: the updated hero and how much the
/// stat actually rose by (for the UI to display, e.g. "攻撃の実で攻撃力が
/// +2 上がった！").
class FruitResult {
  final HeroState hero;
  final int amountGained;

  const FruitResult(this.hero, this.amountGained);
}

/// Applies the effect of consuming a field-usable item (heal potion or
/// fruit). Weapon/shield effects are handled by [BattleService] instead,
/// since they only ever apply inside a battle.
class ItemEffectService {
  const ItemEffectService();

  HeroState useHealPotion(HeroState hero, ItemDefinition item) {
    assert(item.category == ItemCategory.healPotion);
    final healed = hero.currentHp + item.healAmount!;
    return hero.withClampedHp(healed);
  }

  FruitResult useFruit(HeroState hero, ItemDefinition item, RandomService random) {
    assert(item.category == ItemCategory.fruit);
    final amount = random.nextIntInRange(item.fruitMin!, item.fruitMax!);
    switch (item.fruitStat!) {
      case FruitStat.maxHp:
        return FruitResult(
          hero.copyWith(baseMaxHp: hero.baseMaxHp + amount, currentHp: hero.currentHp),
          amount,
        );
      case FruitStat.attack:
        return FruitResult(
          hero.copyWith(baseAttack: hero.baseAttack + amount),
          amount,
        );
      case FruitStat.defense:
        return FruitResult(
          hero.copyWith(baseDefense: hero.baseDefense + amount),
          amount,
        );
    }
  }

  /// Removes the item in [slotIndex], leaving the slot empty.
  HeroState removeFromSlot(HeroState hero, int slotIndex) {
    final inventory = [...hero.inventory];
    inventory[slotIndex] = null;
    return hero.copyWith(inventory: inventory);
  }

  /// Places [itemId] into the first empty slot. Returns `null` if the
  /// inventory is full — the caller should show the swap overlay instead.
  HeroState? tryAutoStore(HeroState hero, String itemId) {
    final slot = hero.emptySlotIndex;
    if (slot == -1) return null;
    final inventory = [...hero.inventory];
    inventory[slot] = InventoryItem(itemId);
    return hero.copyWith(inventory: inventory);
  }

  /// Discards the item in [slotIndex] and puts [itemId] there instead —
  /// used by the full-inventory swap overlay.
  HeroState swapInto(HeroState hero, int slotIndex, String itemId) {
    final inventory = [...hero.inventory];
    inventory[slotIndex] = InventoryItem(itemId);
    return hero.copyWith(inventory: inventory);
  }
}
