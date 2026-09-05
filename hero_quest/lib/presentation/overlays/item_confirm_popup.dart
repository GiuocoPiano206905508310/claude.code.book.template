import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';

/// 消費アイテム使用時の確認ポップアップ。
/// 「○○を使用します。よろしいですか？」
class ItemConfirmPopup extends StatelessWidget {
  const ItemConfirmPopup({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final prompt = controller.pendingConfirm;
    if (prompt == null) return const SizedBox.shrink();

    return Container(
      color: Colors.black54,
      alignment: Alignment.center,
      child: Container(
        width: 300,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${prompt.item.name}を使用します。よろしいですか？', textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(prompt.item.description, style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                OutlinedButton(onPressed: controller.cancelUseItem, child: const Text('キャンセル')),
                ElevatedButton(onPressed: controller.confirmUseItem, child: const Text('使用する')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
