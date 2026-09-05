import 'package:flutter/foundation.dart';

import '../data/master/enemies.dart';
import '../data/master/items.dart';
import '../data/master/stage_registry.dart';
import '../data/save/save_repository.dart';
import 'models/battle_state.dart';
import 'models/hero_state.dart';
import 'models/item.dart';
import 'models/position.dart';
import 'models/save_data.dart';
import 'models/stage.dart';
import 'models/tile.dart';
import 'services/battle_service.dart';
import 'services/gimmick_service.dart';
import 'services/item_effect_service.dart';
import 'services/level_service.dart';
import 'services/loot_service.dart';
import 'services/movement_service.dart';
import 'services/random_service.dart';

/// Explicit game-progress states. The UI (and `GameController` itself)
/// uses this to prevent double-processing input: e.g. `move()` only does
/// anything while `status == movable`.
enum GameStatus {
  title,
  movable,
  battle,
  chestReward,
  inventoryFull,
  itemConfirm,
  stageClear,
  gameOver,
}

/// Non-persistent load error surfaced to the title screen.
enum LoadError { none, corrupted }

/// Pending "○○を使用します。よろしいですか？" confirmation for a
/// field-usable item tapped from the stage screen inventory.
class ItemConfirmPrompt {
  final int slotIndex;
  final ItemDefinition item;

  const ItemConfirmPrompt(this.slotIndex, this.item);
}

/// Pending chest/goal reward waiting to be acknowledged (and, if the
/// inventory was full, resolved via the swap overlay first).
class ChestRewardPrompt {
  final bool isTrap;
  final int trapDamage;
  final String? itemId;
  final bool isGoalReward;

  const ChestRewardPrompt({
    required this.isTrap,
    required this.trapDamage,
    required this.itemId,
    required this.isGoalReward,
  });
}

/// Central, UI-agnostic game state machine. Owns the hero, the current
/// stage's fixed definition and mutable state, any in-progress battle,
/// and orchestrates the domain services. Every mutating method first
/// checks `status` so multiple rapid inputs never double-apply.
class GameController extends ChangeNotifier {
  GameController({SaveRepository? saveRepository})
    : _saveRepository = saveRepository ?? SaveRepository();

  final SaveRepository _saveRepository;
  final MovementService _movementService = const MovementService();
  final BattleService _battleService = const BattleService();
  final GimmickService _gimmickService = const GimmickService();
  final LootService _lootService = const LootService();
  final LevelService _levelService = const LevelService();
  final ItemEffectService _itemEffectService = const ItemEffectService();

  GameStatus status = GameStatus.title;
  LoadError loadError = LoadError.none;
  bool hasSaveFile = false;

  late HeroState hero;
  late StageDefinition stageDef;
  late StageState stageState;
  late RandomService random;

  BattleState? battle;
  ItemConfirmPrompt? pendingConfirm;
  ChestRewardPrompt? pendingReward;

  /// One-line status/event message for the stage screen (e.g. a gimmick
  /// notice), shown until the next event replaces it.
  String message = '';

  Future<void> checkForSave() async {
    hasSaveFile = await _saveRepository.hasSave();
    notifyListeners();
  }

  /// ゲームオーバー画面の「タイトルへ戻る」。
  void returnToTitle() {
    status = GameStatus.title;
    notifyListeners();
    checkForSave();
  }

  // ---------------------------------------------------------------------
  // タイトル画面
  // ---------------------------------------------------------------------

  void startNewGame() {
    hero = HeroState.initial();
    stageDef = StageRegistry.first;
    stageState = StageState.initial(stageDef);
    random = RandomService.fromTime();
    battle = null;
    pendingConfirm = null;
    pendingReward = null;
    loadError = LoadError.none;
    message = '';
    status = GameStatus.movable;
    notifyListeners();
    _autosave();
  }

  Future<void> continueGame() async {
    try {
      final save = await _saveRepository.load();
      if (save == null) {
        loadError = LoadError.corrupted;
        notifyListeners();
        return;
      }
      hero = save.hero;
      stageDef = StageRegistry.byId(save.stageId);
      stageState = save.stageState;
      random = RandomService(seed: save.rngSeed, drawCount: save.rngDrawCount);
      battle = null;
      pendingConfirm = null;
      pendingReward = null;
      loadError = LoadError.none;
      message = '';
      status = GameStatus.movable;
      notifyListeners();
    } on SaveCorruptedException {
      loadError = LoadError.corrupted;
      notifyListeners();
    }
  }

  Future<void> deleteSave() async {
    await _saveRepository.delete();
    hasSaveFile = false;
    notifyListeners();
  }

  Future<void> manualSave() async {
    if (status != GameStatus.movable) return;
    await _autosave();
  }

  Future<void> _autosave() async {
    await _saveRepository.save(
      SaveData(
        stageId: stageDef.id,
        hero: hero,
        stageState: stageState,
        rngSeed: random.seed,
        rngDrawCount: random.drawCount,
        updatedAt: DateTime.now(),
      ),
    );
    hasSaveFile = true;
  }

  // ---------------------------------------------------------------------
  // 移動
  // ---------------------------------------------------------------------

  List<Direction> get availableDirections =>
      status == GameStatus.movable
          ? _movementService.availableDirections(stageDef, stageState)
          : const [];

  void move(Direction direction) {
    if (status != GameStatus.movable) return;

    final result = _movementService.tryMove(stageDef, stageState, direction);
    if (!result.allowed) return;

    final newPosition = result.newPosition!;
    stageState = stageState.copyWith(
      heroPosition: newPosition,
      previousPosition: stageState.heroPosition,
      tileStates: {
        ...stageState.tileStates,
        newPosition.key: stageState.tileStateAt(newPosition).copyWith(visited: true),
      },
    );

    final tile = stageDef.tileAt(newPosition)!;

    if (tile.kind == TileKind.gimmick) {
      final effect = _gimmickService.handleEnter(tile, stageState);
      if (effect.updatedStageState != null) {
        stageState = effect.updatedStageState!;
      }
      if (effect.damage > 0) {
        hero = hero.withClampedHp(hero.currentHp - effect.damage);
        message = 'ダメージ床！ ${effect.damage} ダメージを受けた';
      }
    }

    if (hero.isDead) {
      status = GameStatus.gameOver;
      notifyListeners();
      return;
    }

    notifyListeners();
    _autosave();

    switch (tile.kind) {
      case TileKind.enemy:
        _maybeStartBattle(tile);
        break;
      case TileKind.chest:
        _maybeOpenChest(tile);
        break;
      case TileKind.goal:
        _openGoalReward();
        break;
      default:
        break;
    }
  }

  void _maybeStartBattle(TileDefinition tile) {
    final entry = stageState.enemyStates[tile.position.key];
    if (entry == null || entry.defeated) return;

    final enemyDef = EnemyMaster.byIdOrThrow(entry.enemyDefId);
    final shield = _findFirstItem(ItemCategory.shield);
    battle = _battleService.startBattle(
      hero: hero,
      enemyDef: enemyDef,
      autoShieldItemId: shield?.itemId,
      autoShieldBonus: shield == null ? 0 : ItemMaster.byIdOrThrow(shield.itemId).combatBonus!,
    );
    _consumeAutoShieldIfUsed(shield);
    hero = hero.withClampedHp(battle!.heroHp);
    status = GameStatus.battle;
    notifyListeners();
  }

  // ---------------------------------------------------------------------
  // 戦闘
  // ---------------------------------------------------------------------

  /// Turn >= 2 action. Pass `useItemId` for a selected heal potion, fruit
  /// or weapon; pass `null` for "戦闘を続ける".
  void chooseBattleAction({String? useItemId}) {
    if (status != GameStatus.battle || battle == null) return;
    if (battle!.outcome != BattleOutcome.ongoing) return;

    String? weaponItemId;
    int weaponBonus = 0;

    if (useItemId != null) {
      final def = ItemMaster.byIdOrThrow(useItemId);
      switch (def.category) {
        case ItemCategory.healPotion:
          hero = _itemEffectService.useHealPotion(hero, def);
          hero = _removeItemById(hero, useItemId);
          break;
        case ItemCategory.fruit:
          final result = _itemEffectService.useFruit(hero, def, random);
          hero = result.hero;
          hero = _removeItemById(hero, useItemId);
          break;
        case ItemCategory.weapon:
          weaponItemId = useItemId;
          weaponBonus = def.combatBonus!;
          break;
        case ItemCategory.shield:
          // 盾は自動発動のみ。手動選択は無視する。
          break;
      }
    }

    final shield = _findFirstItem(ItemCategory.shield);
    final before = battle!;
    battle = _battleService.continueTurn(
      battle: battle!,
      heroBaseAttack: hero.baseAttack,
      heroBaseDefense: hero.baseDefense,
      heroHpBeforeTurn: hero.currentHp,
      weaponItemId: weaponItemId,
      weaponBonus: weaponBonus,
      autoShieldItemId: shield?.itemId,
      autoShieldBonus: shield == null ? 0 : ItemMaster.byIdOrThrow(shield.itemId).combatBonus!,
    );

    if (weaponItemId != null &&
        !before.weaponUsedThisBattle &&
        battle!.weaponUsedThisBattle) {
      hero = _removeItemById(hero, weaponItemId);
    }
    _consumeAutoShieldIfUsedTransition(before, battle!, shield);

    hero = hero.withClampedHp(battle!.heroHp);
    notifyListeners();
  }

  InventoryItem? _findFirstItem(ItemCategory category) {
    for (final item in hero.inventory) {
      if (item == null) continue;
      if (ItemMaster.byIdOrThrow(item.itemId).category == category) return item;
    }
    return null;
  }

  void _consumeAutoShieldIfUsed(InventoryItem? candidate) {
    if (candidate != null && battle!.shieldUsedThisBattle) {
      hero = _removeItemById(hero, candidate.itemId);
    }
  }

  void _consumeAutoShieldIfUsedTransition(
    BattleState before,
    BattleState after,
    InventoryItem? candidate,
  ) {
    if (candidate != null && !before.shieldUsedThisBattle && after.shieldUsedThisBattle) {
      hero = _removeItemById(hero, candidate.itemId);
    }
  }

  HeroState _removeItemById(HeroState h, String itemId) {
    final index = h.inventory.indexWhere((i) => i?.itemId == itemId);
    if (index == -1) return h;
    return _itemEffectService.removeFromSlot(h, index);
  }

  /// 勝敗表示（戦闘オーバーレイの「閉じる」）を確認して戦闘を終える。
  int lastLevelsGained = 0;

  void acknowledgeBattleEnd() {
    if (status != GameStatus.battle || battle == null) return;
    final result = battle!;
    if (result.outcome == BattleOutcome.ongoing) return;

    if (result.outcome == BattleOutcome.victory) {
      final levelUp = _levelService.grantExp(hero, result.expReward);
      hero = levelUp.hero;
      lastLevelsGained = levelUp.levelsGained;
      final key = stageState.heroPosition.key;
      final entry = stageState.enemyStates[key];
      if (entry != null) {
        stageState = stageState.withEnemyState(
          stageState.heroPosition,
          entry.copyWith(defeated: true),
        );
      }
      battle = null;
      status = GameStatus.movable;
      notifyListeners();
      _autosave();
    } else {
      battle = null;
      status = GameStatus.gameOver;
      notifyListeners();
    }
  }

  /// ゲームオーバー画面の「リトライ」。直近のオートセーブ（戦闘開始直前
  /// の状態）から再開する。ゲームオーバー時の再開地点はMVP仮仕様
  /// （README参照）。
  Future<void> retryFromLastSave() => continueGame();

  // ---------------------------------------------------------------------
  // 宝箱
  // ---------------------------------------------------------------------

  void _maybeOpenChest(TileDefinition tile) {
    final existing = stageState.tileStateAt(tile.position);
    if (existing.chestOpened) return;
    _openChestLike(tile.position, tile.chestSize!, isGoalReward: false);
  }

  void _openGoalReward() {
    _openChestLike(stageState.heroPosition, ChestSize.large, isGoalReward: true);
  }

  void _openChestLike(Position position, ChestSize size, {required bool isGoalReward}) {
    final result = _lootService.openChest(size, random);
    final tileState = stageState.tileStateAt(position);
    stageState = stageState.withTileState(
      position,
      tileState.copyWith(
        chestOpened: true,
        chestIsTrap: result.isTrap,
        chestItemId: result.itemId,
      ),
    );

    if (result.isTrap) {
      hero = hero.withClampedHp(hero.currentHp - result.trapDamage);
      pendingReward = ChestRewardPrompt(
        isTrap: true,
        trapDamage: result.trapDamage,
        itemId: null,
        isGoalReward: isGoalReward,
      );
      status = GameStatus.chestReward;
      notifyListeners();
      return;
    }

    if (hero.hasEmptySlot) {
      hero = _itemEffectService.tryAutoStore(hero, result.itemId!) ?? hero;
      pendingReward = ChestRewardPrompt(
        isTrap: false,
        trapDamage: 0,
        itemId: result.itemId,
        isGoalReward: isGoalReward,
      );
      status = GameStatus.chestReward;
    } else {
      pendingReward = ChestRewardPrompt(
        isTrap: false,
        trapDamage: 0,
        itemId: result.itemId,
        isGoalReward: isGoalReward,
      );
      status = GameStatus.inventoryFull;
    }
    notifyListeners();
  }

  /// 所持枠が満杯のときの入れ替え。[slotIndex]の既存アイテムを捨てて
  /// 新アイテムを得る。
  void swapInventorySlot(int slotIndex) {
    if (status != GameStatus.inventoryFull || pendingReward?.itemId == null) return;
    hero = _itemEffectService.swapInto(hero, slotIndex, pendingReward!.itemId!);
    _finishRewardFlow();
  }

  /// 所持枠が満杯のときに新アイテムを諦める。
  void discardNewReward() {
    if (status != GameStatus.inventoryFull) return;
    _finishRewardFlow();
  }

  /// トラップ結果やアイテム獲得結果を確認して閉じる。
  void acknowledgeReward() {
    if (status != GameStatus.chestReward) return;
    if (hero.isDead) {
      status = GameStatus.gameOver;
      pendingReward = null;
      notifyListeners();
      return;
    }
    _finishRewardFlow();
  }

  /// ステージクリア画面に表示する、大宝箱で獲得したアイテムid。
  String? lastGoalRewardItemId;

  void _finishRewardFlow() {
    final wasGoal = pendingReward?.isGoalReward ?? false;
    if (wasGoal) {
      lastGoalRewardItemId = pendingReward?.itemId;
    }
    pendingReward = null;
    status = wasGoal ? GameStatus.stageClear : GameStatus.movable;
    notifyListeners();
    _autosave();
  }

  void advanceToNextStage() {
    if (status != GameStatus.stageClear) return;
    final next = StageRegistry.next(stageDef.id);
    if (next == null) {
      // MVPで用意した最後のステージ。タイトルへ戻る。
      status = GameStatus.title;
      notifyListeners();
      return;
    }
    stageDef = next;
    stageState = StageState.initial(next);
    status = GameStatus.movable;
    notifyListeners();
    _autosave();
  }

  // ---------------------------------------------------------------------
  // フィールドでのアイテム使用（回復薬・実）
  // ---------------------------------------------------------------------

  void requestUseItem(int slotIndex) {
    if (status != GameStatus.movable) return;
    final slot = hero.inventory[slotIndex];
    if (slot == null) return;
    final def = ItemMaster.byIdOrThrow(slot.itemId);
    if (!def.isFieldUsable) return;
    pendingConfirm = ItemConfirmPrompt(slotIndex, def);
    status = GameStatus.itemConfirm;
    notifyListeners();
  }

  void cancelUseItem() {
    if (status != GameStatus.itemConfirm) return;
    pendingConfirm = null;
    status = GameStatus.movable;
    notifyListeners();
  }

  void confirmUseItem() {
    if (status != GameStatus.itemConfirm || pendingConfirm == null) return;
    final prompt = pendingConfirm!;
    switch (prompt.item.category) {
      case ItemCategory.healPotion:
        hero = _itemEffectService.useHealPotion(hero, prompt.item);
        break;
      case ItemCategory.fruit:
        final result = _itemEffectService.useFruit(hero, prompt.item, random);
        hero = result.hero;
        break;
      case ItemCategory.weapon:
      case ItemCategory.shield:
        break;
    }
    hero = _itemEffectService.removeFromSlot(hero, prompt.slotIndex);
    pendingConfirm = null;
    status = GameStatus.movable;
    notifyListeners();
    _autosave();
  }
}
