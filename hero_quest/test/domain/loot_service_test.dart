import 'package:flutter_test/flutter_test.dart';
import 'package:hero_quest/data/master/game_balance.dart';
import 'package:hero_quest/data/master/loot_tables.dart';
import 'package:hero_quest/domain/models/tile.dart';
import 'package:hero_quest/domain/services/loot_service.dart';
import 'package:hero_quest/domain/services/random_service.dart';

void main() {
  const service = LootService();
  const trials = 20000;
  const tolerance = 0.02; // ±2ポイント

  test('小・中宝箱の重みテーブルの合計は100', () {
    expect(LootTables.small.fold<double>(0, (s, e) => s + e.weight), 100);
    expect(LootTables.medium.fold<double>(0, (s, e) => s + e.weight), 100);
  });

  test('小宝箱の抽選比率が重みどおりになる（統計検証）', () {
    final random = RandomService(seed: 42);
    final counts = <String, int>{};
    var trapCount = 0;
    for (var i = 0; i < trials; i++) {
      final result = service.openChest(ChestSize.small, random);
      if (result.isTrap) {
        trapCount++;
      } else {
        counts[result.itemId!] = (counts[result.itemId!] ?? 0) + 1;
      }
    }

    expect(trapCount / trials, closeTo(GameBalance.smallChestTrapRate, tolerance));

    final nonTrapTotal = trials - trapCount;
    for (final entry in LootTables.small) {
      final expectedRatio = entry.weight / 100;
      final actualRatio = (counts[entry.itemId] ?? 0) / nonTrapTotal;
      expect(actualRatio, closeTo(expectedRatio, tolerance));
    }
  });

  test('中宝箱のトラップ率が仮設定どおりになる（統計検証）', () {
    final random = RandomService(seed: 7);
    var trapCount = 0;
    for (var i = 0; i < trials; i++) {
      if (service.openChest(ChestSize.medium, random).isTrap) trapCount++;
    }
    expect(trapCount / trials, closeTo(GameBalance.mediumChestTrapRate, tolerance));
  });

  test('大宝箱はプラチナ盾15%・プラチナ大剣15%で、トラップを含まない', () {
    final random = RandomService(seed: 99);
    final counts = <String, int>{};
    for (var i = 0; i < trials; i++) {
      final result = service.openChest(ChestSize.large, random);
      expect(result.isTrap, isFalse);
      counts[result.itemId!] = (counts[result.itemId!] ?? 0) + 1;
    }

    final platinumShieldRatio = (counts['shield_platinum'] ?? 0) / trials;
    final platinumSwordRatio = (counts['weapon_platinum_greatsword'] ?? 0) / trials;
    expect(platinumShieldRatio, closeTo(0.15, tolerance));
    expect(platinumSwordRatio, closeTo(0.15, tolerance));

    // 残り70%は5種で均等(14%ずつ)。
    for (final id in ['heal_potion_l', 'shield_gold', 'fruit_hp', 'fruit_attack', 'fruit_defense']) {
      final ratio = (counts[id] ?? 0) / trials;
      expect(ratio, closeTo(0.14, tolerance));
    }
  });
}
