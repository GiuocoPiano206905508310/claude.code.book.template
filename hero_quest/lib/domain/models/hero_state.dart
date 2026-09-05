import '../../data/master/game_balance.dart';
import 'item.dart';

/// The player character's persistent progress: level, base stats, current
/// HP and inventory. This is the only model that carries over between
/// stages.
class HeroState {
  final int level;
  final int exp;

  /// Base stats already include every level-up and every fruit item ever
  /// consumed. They do not include temporary in-battle bonuses.
  final int baseMaxHp;
  final int baseAttack;
  final int baseDefense;

  final int currentHp;

  /// Fixed-length list of [GameBalance.inventorySlotCount] slots; `null`
  /// means the slot is empty.
  final List<InventoryItem?> inventory;

  HeroState({
    required this.level,
    required this.exp,
    required this.baseMaxHp,
    required this.baseAttack,
    required this.baseDefense,
    required this.currentHp,
    required List<InventoryItem?> inventory,
  }) : inventory = List<InventoryItem?>.unmodifiable(inventory);

  factory HeroState.initial() => HeroState(
    level: 1,
    exp: 0,
    baseMaxHp: GameBalance.initialMaxHp,
    baseAttack: GameBalance.initialAttack,
    baseDefense: GameBalance.initialDefense,
    currentHp: GameBalance.initialMaxHp,
    inventory: List<InventoryItem?>.filled(GameBalance.inventorySlotCount, null),
  );

  bool get isDead => currentHp <= 0;

  int get emptySlotIndex => inventory.indexWhere((item) => item == null);

  bool get hasEmptySlot => emptySlotIndex != -1;

  HeroState copyWith({
    int? level,
    int? exp,
    int? baseMaxHp,
    int? baseAttack,
    int? baseDefense,
    int? currentHp,
    List<InventoryItem?>? inventory,
  }) {
    return HeroState(
      level: level ?? this.level,
      exp: exp ?? this.exp,
      baseMaxHp: baseMaxHp ?? this.baseMaxHp,
      baseAttack: baseAttack ?? this.baseAttack,
      baseDefense: baseDefense ?? this.baseDefense,
      currentHp: currentHp ?? this.currentHp,
      inventory: inventory ?? this.inventory,
    );
  }

  /// Returns a copy with HP clamped to the valid [0, baseMaxHp] range.
  HeroState withClampedHp(int newHp) {
    final clamped = newHp.clamp(0, baseMaxHp);
    return copyWith(currentHp: clamped);
  }

  Map<String, dynamic> toJson() => {
    'level': level,
    'exp': exp,
    'baseMaxHp': baseMaxHp,
    'baseAttack': baseAttack,
    'baseDefense': baseDefense,
    'currentHp': currentHp,
    'inventory': inventory.map((item) => item?.toJson()).toList(),
  };

  factory HeroState.fromJson(Map<String, dynamic> json) {
    final rawInventory = json['inventory'] as List<dynamic>;
    return HeroState(
      level: json['level'] as int,
      exp: json['exp'] as int,
      baseMaxHp: json['baseMaxHp'] as int,
      baseAttack: json['baseAttack'] as int,
      baseDefense: json['baseDefense'] as int,
      currentHp: json['currentHp'] as int,
      inventory: rawInventory
          .map(
            (raw) => raw == null
                ? null
                : InventoryItem.fromJson(raw as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
