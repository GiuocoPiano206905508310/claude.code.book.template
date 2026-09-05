import 'package:flutter/material.dart';

import '../../data/master/items.dart';
import '../../domain/game_controller.dart';

/// 宝箱獲得画面。獲得アイテムの名称・効果、またはトラップ発動時の
/// ダメージを表示する。
class ChestRewardOverlay extends StatelessWidget {
  const ChestRewardOverlay({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final reward = controller.pendingReward;
    if (reward == null) return const SizedBox.shrink();

    final title = reward.isGoalReward ? '大宝箱' : '宝箱';

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
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (reward.isTrap) ...[
              const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 48),
              const SizedBox(height: 8),
              Text('トラップだった！ ${reward.trapDamage}ダメージを受けた',
                  textAlign: TextAlign.center),
            ] else ...[
              Builder(builder: (context) {
                final def = ItemMaster.byIdOrThrow(reward.itemId!);
                return Column(
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 350),
                      curve: Curves.elasticOut,
                      builder: (context, scale, child) =>
                          Transform.scale(scale: scale, child: child),
                      child: Image.asset(
                        'assets/images/${def.imageId}.png',
                        width: 64,
                        height: 64,
                        filterQuality: FilterQuality.none,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(def.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(def.description, textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    const Text('を手に入れた！'),
                  ],
                );
              }),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: controller.acknowledgeReward,
              child: const Text('閉じる'),
            ),
          ],
        ),
      ),
    );
  }
}
