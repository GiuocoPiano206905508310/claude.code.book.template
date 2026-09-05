/// One weighted entry in a chest's loot table.
class LootEntry {
  final String itemId;
  final double weight;

  const LootEntry(this.itemId, this.weight);
}

/// Weighted loot tables for each chest size (仮設定 — 確率は
/// `GameBalance` のトラップ率とあわせて、後から調整できるようにここへ
/// 集約している). Weights are percentages and are asserted to sum to 100
/// in tests, but `RandomService.pickWeighted` works with any positive
/// weights.
class LootTables {
  const LootTables._();

  /// 小宝箱の中身抽選テーブル。
  static const List<LootEntry> small = [
    LootEntry('heal_potion_s', 25),
    LootEntry('heal_potion_m', 15),
    LootEntry('shield_wood', 15),
    LootEntry('shield_iron', 10),
    LootEntry('weapon_club', 20),
    LootEntry('weapon_iron_hammer', 15),
  ];

  /// 中宝箱の中身抽選テーブル。
  static const List<LootEntry> medium = [
    LootEntry('heal_potion_m', 25),
    LootEntry('heal_potion_l', 5),
    LootEntry('shield_bronze', 20),
    LootEntry('shield_silver', 5),
    LootEntry('weapon_bronze_spear', 25),
    LootEntry('weapon_silver_axe', 10),
    LootEntry('weapon_gold_sword', 10),
  ];

  /// 大宝箱（ゴールの大宝箱）の中身抽選テーブル。プラチナ装備2種で
  /// 合計30%、残り70%を5種で均等（14%ずつ）に抽選する。トラップは
  /// 含めない。
  static const List<LootEntry> large = [
    LootEntry('shield_platinum', 15),
    LootEntry('weapon_platinum_greatsword', 15),
    LootEntry('heal_potion_l', 14),
    LootEntry('shield_gold', 14),
    LootEntry('fruit_hp', 14),
    LootEntry('fruit_attack', 14),
    LootEntry('fruit_defense', 14),
  ];
}
