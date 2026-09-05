import '../../data/master/game_balance.dart';
import '../../data/master/loot_tables.dart';
import '../models/tile.dart';
import 'random_service.dart';

/// Result of opening a chest: either a trap (damage, no item) or an item.
class ChestResult {
  final bool isTrap;
  final String? itemId;
  final int trapDamage;

  const ChestResult.item(this.itemId) : isTrap = false, trapDamage = 0;

  const ChestResult.trap(this.trapDamage) : isTrap = true, itemId = null;
}

/// Weighted loot rolls for chests. All randomness goes through the
/// injected [RandomService] so results are reproducible under a fixed
/// seed in tests.
class LootService {
  const LootService();

  ChestResult openChest(ChestSize size, RandomService random) {
    if (size == ChestSize.large) {
      return ChestResult.item(_pick(LootTables.large, random));
    }

    final trapRate = size == ChestSize.small
        ? GameBalance.smallChestTrapRate
        : GameBalance.mediumChestTrapRate;
    if (random.rollChance(trapRate)) {
      final damage = size == ChestSize.small
          ? GameBalance.smallChestTrapDamage
          : GameBalance.mediumChestTrapDamage;
      return ChestResult.trap(damage);
    }

    final table = size == ChestSize.small ? LootTables.small : LootTables.medium;
    return ChestResult.item(_pick(table, random));
  }

  String _pick(List<LootEntry> table, RandomService random) {
    return random.pickWeighted(
      table.map((e) => e.itemId).toList(),
      table.map((e) => e.weight).toList(),
    );
  }
}
