/// Category of an item, which decides how it can be used.
enum ItemCategory {
  /// Consumed by tapping in the inventory; restores current HP.
  healPotion,

  /// Consumed by tapping in the inventory; permanently raises a base stat.
  fruit,

  /// Consumed during battle (player-selected); adds a temporary attack bonus.
  weapon,

  /// Consumed during battle (auto-used on first hit taken); adds a temporary
  /// defense bonus.
  shield,
}

/// Which base stat a fruit item raises.
enum FruitStat { maxHp, attack, defense }

/// Master data describing one kind of item. Looked up by [id] from
/// [InventoryItem]s and loot tables.
class ItemDefinition {
  final String id;
  final String name;
  final String description;
  final ItemCategory category;
  final String imageId;

  /// [ItemCategory.healPotion] only: HP restored on use.
  final int? healAmount;

  /// [ItemCategory.fruit] only: which base stat is raised.
  final FruitStat? fruitStat;

  /// [ItemCategory.fruit] only: inclusive random range added to the base
  /// stat, e.g. HPの実 is 1〜5.
  final int? fruitMin;
  final int? fruitMax;

  /// [ItemCategory.weapon] or [ItemCategory.shield] only: the temporary
  /// attack/defense bonus applied for the rest of the battle.
  final int? combatBonus;

  const ItemDefinition({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.imageId,
    this.healAmount,
    this.fruitStat,
    this.fruitMin,
    this.fruitMax,
    this.combatBonus,
  });

  /// Whether this item can be used from the stage screen (outside battle).
  bool get isFieldUsable =>
      category == ItemCategory.healPotion || category == ItemCategory.fruit;

  /// Whether the player can actively choose to use this item during battle.
  /// Shields are excluded because they trigger automatically.
  bool get isBattleSelectable =>
      category == ItemCategory.healPotion ||
      category == ItemCategory.fruit ||
      category == ItemCategory.weapon;
}

/// A single occupied inventory slot. Items never stack: one slot holds
/// exactly one item instance, referenced by its definition id.
class InventoryItem {
  final String itemId;

  const InventoryItem(this.itemId);

  Map<String, dynamic> toJson() => {'itemId': itemId};

  factory InventoryItem.fromJson(Map<String, dynamic> json) =>
      InventoryItem(json['itemId'] as String);

  @override
  bool operator ==(Object other) =>
      other is InventoryItem && other.itemId == itemId;

  @override
  int get hashCode => itemId.hashCode;
}
