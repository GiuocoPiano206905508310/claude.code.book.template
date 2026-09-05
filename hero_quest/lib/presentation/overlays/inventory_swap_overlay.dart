import 'package:flutter/material.dart';

import '../../data/master/items.dart';
import '../../domain/game_controller.dart';

/// 所持枠が満杯のときの入れ替え画面。現在の3アイテムと新アイテムを
/// 表示し、既存アイテム1つを捨てて新アイテムを得るか、新アイテムを
/// 諦めるかを選べる。捨てる操作は確認ダイアログを挟む。
class InventorySwapOverlay extends StatelessWidget {
  const InventorySwapOverlay({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final reward = controller.pendingReward;
    if (reward == null || reward.itemId == null) return const SizedBox.shrink();
    final newItem = ItemMaster.byIdOrThrow(reward.itemId!);
    final hero = controller.hero;

    return Container(
      color: Colors.black54,
      alignment: Alignment.center,
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('持ち物がいっぱいです', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Text('新しいアイテム: ${newItem.name}\n${newItem.description}', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            const Text('入れ替えるアイテムを選んでください', style: TextStyle(fontSize: 12, color: Colors.black54)),
            const SizedBox(height: 8),
            ...List.generate(hero.inventory.length, (index) {
              final slot = hero.inventory[index];
              if (slot == null) return const SizedBox.shrink();
              final def = ItemMaster.byIdOrThrow(slot.itemId);
              return Card(
                child: ListTile(
                  leading: Image.asset(
                    'assets/images/${def.imageId}.png',
                    width: 32,
                    height: 32,
                    filterQuality: FilterQuality.none,
                  ),
                  title: Text(def.name),
                  subtitle: Text(def.description),
                  trailing: const Icon(Icons.swap_horiz),
                  onTap: () => _confirmDiscardAndSwap(context, index, def.name, newItem.name),
                ),
              );
            }),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: controller.discardNewReward,
              child: Text('${newItem.name}を諦める'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDiscardAndSwap(
    BuildContext context,
    int slotIndex,
    String oldName,
    String newName,
  ) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('確認'),
        content: Text('$oldNameを捨てて$newNameを手に入れます。よろしいですか？\n（捨てたアイテムは元に戻せません）'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('キャンセル')),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              controller.swapInventorySlot(slotIndex);
            },
            child: const Text('入れ替える'),
          ),
        ],
      ),
    );
  }
}
