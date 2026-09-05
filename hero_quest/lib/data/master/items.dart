import '../../domain/models/item.dart';

/// Master table of every item in the game, keyed by id. Add a new item by
/// adding an entry here and (optionally) to a loot table in
/// `loot_tables.dart` — no other code changes are required.
class ItemMaster {
  const ItemMaster._();

  static const Map<String, ItemDefinition> byId = {
    'heal_potion_s': ItemDefinition(
      id: 'heal_potion_s',
      name: '回復薬（小）',
      description: 'HPを3回復する。',
      category: ItemCategory.healPotion,
      imageId: 'item_heal_potion_s',
      healAmount: 3,
    ),
    'heal_potion_m': ItemDefinition(
      id: 'heal_potion_m',
      name: '回復薬（中）',
      description: 'HPを5回復する。',
      category: ItemCategory.healPotion,
      imageId: 'item_heal_potion_m',
      healAmount: 5,
    ),
    'heal_potion_l': ItemDefinition(
      id: 'heal_potion_l',
      name: '回復薬（大）',
      description: 'HPを10回復する。',
      category: ItemCategory.healPotion,
      imageId: 'item_heal_potion_l',
      healAmount: 10,
    ),
    'shield_wood': ItemDefinition(
      id: 'shield_wood',
      name: '木の盾',
      description: '戦闘中の防御力+1。',
      category: ItemCategory.shield,
      imageId: 'item_shield_wood',
      combatBonus: 1,
    ),
    'shield_iron': ItemDefinition(
      id: 'shield_iron',
      name: '鉄の盾',
      description: '戦闘中の防御力+2。',
      category: ItemCategory.shield,
      imageId: 'item_shield_iron',
      combatBonus: 2,
    ),
    'shield_bronze': ItemDefinition(
      id: 'shield_bronze',
      name: '銅の盾',
      description: '戦闘中の防御力+3。',
      category: ItemCategory.shield,
      imageId: 'item_shield_bronze',
      combatBonus: 3,
    ),
    'shield_silver': ItemDefinition(
      id: 'shield_silver',
      name: '銀の盾',
      description: '戦闘中の防御力+4。',
      category: ItemCategory.shield,
      imageId: 'item_shield_silver',
      combatBonus: 4,
    ),
    'shield_gold': ItemDefinition(
      id: 'shield_gold',
      name: '金の盾',
      description: '戦闘中の防御力+5。',
      category: ItemCategory.shield,
      imageId: 'item_shield_gold',
      combatBonus: 5,
    ),
    'shield_platinum': ItemDefinition(
      id: 'shield_platinum',
      name: 'プラチナの盾',
      description: '戦闘中の防御力+8。',
      category: ItemCategory.shield,
      imageId: 'item_shield_platinum',
      combatBonus: 8,
    ),
    'weapon_club': ItemDefinition(
      id: 'weapon_club',
      name: 'こんぼう',
      description: '戦闘中の攻撃力+2。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_club',
      combatBonus: 2,
    ),
    'weapon_iron_hammer': ItemDefinition(
      id: 'weapon_iron_hammer',
      name: '鉄のハンマー',
      description: '戦闘中の攻撃力+3。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_iron_hammer',
      combatBonus: 3,
    ),
    'weapon_bronze_spear': ItemDefinition(
      id: 'weapon_bronze_spear',
      name: '銅のヤリ',
      description: '戦闘中の攻撃力+4。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_bronze_spear',
      combatBonus: 4,
    ),
    'weapon_silver_axe': ItemDefinition(
      id: 'weapon_silver_axe',
      name: '銀のオノ',
      description: '戦闘中の攻撃力+5。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_silver_axe',
      combatBonus: 5,
    ),
    'weapon_gold_sword': ItemDefinition(
      id: 'weapon_gold_sword',
      name: '金の剣',
      description: '戦闘中の攻撃力+6。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_gold_sword',
      combatBonus: 6,
    ),
    'weapon_platinum_greatsword': ItemDefinition(
      id: 'weapon_platinum_greatsword',
      name: 'プラチナの大剣',
      description: '戦闘中の攻撃力+8。',
      category: ItemCategory.weapon,
      imageId: 'item_weapon_platinum_greatsword',
      combatBonus: 8,
    ),
    'fruit_hp': ItemDefinition(
      id: 'fruit_hp',
      name: 'HPの実',
      description: '最大HPの基礎値を1〜5ランダムで上昇させる。',
      category: ItemCategory.fruit,
      imageId: 'item_fruit_hp',
      fruitStat: FruitStat.maxHp,
      fruitMin: 1,
      fruitMax: 5,
    ),
    'fruit_attack': ItemDefinition(
      id: 'fruit_attack',
      name: '攻撃の実',
      description: '攻撃力の基礎値を1〜3ランダムで上昇させる。',
      category: ItemCategory.fruit,
      imageId: 'item_fruit_attack',
      fruitStat: FruitStat.attack,
      fruitMin: 1,
      fruitMax: 3,
    ),
    'fruit_defense': ItemDefinition(
      id: 'fruit_defense',
      name: '防御の実',
      description: '防御力の基礎値を1〜3ランダムで上昇させる。',
      category: ItemCategory.fruit,
      imageId: 'item_fruit_defense',
      fruitStat: FruitStat.defense,
      fruitMin: 1,
      fruitMax: 3,
    ),
  };

  static ItemDefinition byIdOrThrow(String id) {
    final item = byId[id];
    if (item == null) {
      throw ArgumentError('unknown item id: $id');
    }
    return item;
  }
}
