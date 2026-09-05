import 'package:flutter/material.dart';

import '../../data/master/items.dart';
import '../../data/master/stage_registry.dart';
import '../../domain/game_controller.dart';

/// ステージクリア画面。大宝箱の報酬と、次のステージへ進むボタンを
/// 表示する。
class StageClearScreen extends StatelessWidget {
  const StageClearScreen({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final rewardId = controller.lastGoalRewardItemId;
    final hasNext = StageRegistry.next(controller.stageDef.id) != null;

    return Scaffold(
      backgroundColor: Colors.amber.shade50,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.emoji_events, color: Colors.amber, size: 72),
                const SizedBox(height: 12),
                Text('ステージクリア！', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text('${controller.stageDef.displayName} をクリアしました'),
                const SizedBox(height: 24),
                if (rewardId != null) _rewardCard(context, rewardId),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: controller.advanceToNextStage,
                  child: Text(hasNext ? '次のステージへ進む' : 'タイトルへ戻る'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _rewardCard(BuildContext context, String itemId) {
    final def = ItemMaster.byIdOrThrow(itemId);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text('大宝箱の報酬', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            Image.asset(
              'assets/images/${def.imageId}.png',
              width: 56,
              height: 56,
              filterQuality: FilterQuality.none,
            ),
            const SizedBox(height: 8),
            Text(def.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(def.description),
          ],
        ),
      ),
    );
  }
}
