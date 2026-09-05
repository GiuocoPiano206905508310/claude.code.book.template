import 'package:flutter/material.dart';

import '../../data/master/items.dart';
import '../../domain/game_controller.dart';
import '../../domain/models/battle_state.dart';
import '../../domain/models/hero_state.dart';
import '../../domain/models/item.dart';
import '../widgets/hp_badge.dart';

/// 戦闘表示。勇者と敵の名前・HP、1ターンずつのログ、2ターン目以降の
/// アイテム選択を表示する。
class BattleOverlay extends StatelessWidget {
  const BattleOverlay({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final battle = controller.battle;
    if (battle == null) return const SizedBox.shrink();

    return Container(
      color: Colors.black54,
      alignment: Alignment.center,
      child: Container(
        width: 340,
        constraints: const BoxConstraints(maxHeight: 480),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('戦闘${battle.isBoss ? '（ボス）' : ''}',
                style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                HpBadge(label: '勇者', hp: battle.heroHp, maxHp: battle.heroMaxHp),
                const Icon(Icons.compare_arrows),
                HpBadge(label: battle.enemyName, hp: battle.enemyHp, maxHp: battle.enemyMaxHp),
              ],
            ),
            const SizedBox(height: 12),
            Flexible(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: battle.log
                      .map((e) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Text(e.message),
                          ))
                      .toList(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (battle.outcome == BattleOutcome.ongoing)
              _actionArea(context)
            else
              _outcomeArea(context, battle),
          ],
        ),
      ),
    );
  }

  Widget _actionArea(BuildContext context) {
    final hero = controller.hero;
    final items = _battleSelectableItems(hero);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton(
          onPressed: () => controller.chooseBattleAction(),
          child: const Text('戦闘を続ける'),
        ),
        if (items.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('アイテムを使う', style: TextStyle(fontSize: 12, color: Colors.black54)),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: items
                .map(
                  (item) => OutlinedButton(
                    onPressed: () => controller.chooseBattleAction(useItemId: item.id),
                    child: Text(item.name),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }

  Widget _outcomeArea(BuildContext context, BattleState battle) {
    final victory = battle.outcome == BattleOutcome.victory;
    return Column(
      children: [
        Text(
          victory ? '勝利！ 経験値 +${battle.expReward}' : '勇者は倒れてしまった…',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: victory ? Colors.green.shade700 : Colors.red.shade700,
          ),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: controller.acknowledgeBattleEnd,
          child: const Text('閉じる'),
        ),
      ],
    );
  }

  List<ItemDefinition> _battleSelectableItems(HeroState hero) {
    final seen = <String>{};
    final result = <ItemDefinition>[];
    for (final slot in hero.inventory) {
      if (slot == null) continue;
      final def = ItemMaster.byIdOrThrow(slot.itemId);
      if (def.isBattleSelectable && seen.add(def.id)) {
        result.add(def);
      }
    }
    return result;
  }
}
