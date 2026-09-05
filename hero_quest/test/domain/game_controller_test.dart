import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hero_quest/domain/game_controller.dart';
import 'package:hero_quest/domain/models/item.dart';
import 'package:hero_quest/domain/models/position.dart';
import 'package:hero_quest/domain/models/tile.dart';
import 'package:hero_quest/domain/services/random_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  /// スライム討伐まで完了した状態で、小宝箱 (0,4) の手前 (0,3) に
  /// 勇者を人為的に配置する。戦闘そのものは battle_service_test で
  /// 別途検証済みのため、ここでは宝箱まわりのフローに集中する。
  GameController placeHeroJustBeforeSmallChest() {
    final controller = GameController();
    controller.startNewGame();
    controller.random = RandomService(seed: 1); // 決定的な抽選結果にする

    const before = [Position(1, 0), Position(1, 1), Position(1, 2), Position(0, 2), Position(0, 3)];
    var tileStates = controller.stageState.tileStates;
    for (final p in before) {
      tileStates = {...tileStates, p.key: const TileState(visited: true)};
    }
    var enemyStates = controller.stageState.enemyStates;
    enemyStates = {
      ...enemyStates,
      const Position(0, 3).key: enemyStates[const Position(0, 3).key]!.copyWith(defeated: true),
    };

    controller.stageState = controller.stageState.copyWith(
      heroPosition: const Position(0, 3),
      tileStates: tileStates,
      enemyStates: enemyStates,
    );
    return controller;
  }

  test('所持枠が満杯のとき、宝箱を開けると入れ替え画面になる', () {
    final controller = placeHeroJustBeforeSmallChest();
    controller.hero = controller.hero.copyWith(inventory: const [
      InventoryItem('heal_potion_s'),
      InventoryItem('heal_potion_m'),
      InventoryItem('shield_wood'),
    ]);

    controller.move(Direction.down); // (0,3) -> (0,4) 小宝箱

    expect(controller.status, GameStatus.inventoryFull);
    expect(controller.pendingReward, isNotNull);
    expect(controller.pendingReward!.itemId, isNotNull);
  });

  test('入れ替えを選ぶと該当枠が新アイテムに置き換わる', () {
    final controller = placeHeroJustBeforeSmallChest();
    controller.hero = controller.hero.copyWith(inventory: const [
      InventoryItem('heal_potion_s'),
      InventoryItem('heal_potion_m'),
      InventoryItem('shield_wood'),
    ]);
    controller.move(Direction.down);
    final newItemId = controller.pendingReward!.itemId!;

    controller.swapInventorySlot(1);

    expect(controller.status, GameStatus.movable);
    expect(controller.hero.inventory[1]?.itemId, newItemId);
    expect(controller.hero.inventory[0]?.itemId, 'heal_potion_s');
    expect(controller.hero.inventory[2]?.itemId, 'shield_wood');
  });

  test('新アイテムを諦めると所持品は変化しない', () {
    final controller = placeHeroJustBeforeSmallChest();
    const original = [
      InventoryItem('heal_potion_s'),
      InventoryItem('heal_potion_m'),
      InventoryItem('shield_wood'),
    ];
    controller.hero = controller.hero.copyWith(inventory: original);
    controller.move(Direction.down);

    controller.discardNewReward();

    expect(controller.status, GameStatus.movable);
    expect(controller.hero.inventory.map((e) => e?.itemId).toList(), original.map((e) => e.itemId).toList());
  });

  test('空き枠があれば宝箱の中身は自動で格納される', () {
    final controller = placeHeroJustBeforeSmallChest();
    expect(controller.hero.hasEmptySlot, isTrue);

    controller.move(Direction.down);

    expect(controller.status, GameStatus.chestReward);
    final itemId = controller.pendingReward!.itemId;
    if (itemId != null) {
      expect(controller.hero.inventory.any((slot) => slot?.itemId == itemId), isTrue);
    }
  });

  test('後戻り(訪問済みマスへの移動)は無視される', () {
    final controller = GameController();
    controller.startNewGame();
    final start = controller.stageState.heroPosition;

    controller.move(Direction.down);
    final afterFirstMove = controller.stageState.heroPosition;
    expect(afterFirstMove, isNot(start));

    controller.move(Direction.up); // 既に訪問済みなので拒否される
    expect(controller.stageState.heroPosition, afterFirstMove);
  });
}
