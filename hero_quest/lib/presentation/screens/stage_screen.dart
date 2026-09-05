import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';
import '../overlays/battle_overlay.dart';
import '../overlays/chest_reward_overlay.dart';
import '../overlays/inventory_swap_overlay.dart';
import '../overlays/item_confirm_popup.dart';
import '../widgets/dpad.dart';
import '../widgets/hero_hud.dart';
import '../widgets/stage_board.dart';

/// ステージ画面。コース全体、HUD、十字キー、セーブボタンを表示し、
/// 状態に応じて戦闘/宝箱/入れ替え/確認オーバーレイを重ねる。
/// レベルアップやギミック発動時には簡易バナーで通知する。
class StageScreen extends StatefulWidget {
  const StageScreen({super.key, required this.controller});

  final GameController controller;

  @override
  State<StageScreen> createState() => _StageScreenState();
}

class _StageScreenState extends State<StageScreen> {
  late int _lastKnownLevel;
  String _lastShownMessage = '';

  @override
  void initState() {
    super.initState();
    _lastKnownLevel = widget.controller.hero.level;
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final canSave = controller.status == GameStatus.movable;

    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForNotices(controller));

    return Scaffold(
      appBar: AppBar(
        title: Text(controller.stageDef.displayName),
        actions: [
          IconButton(
            icon: const Icon(Icons.save),
            tooltip: 'セーブ',
            onPressed: canSave ? controller.manualSave : null,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            HeroHud(controller: controller),
            Expanded(
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: StageBoard(controller: controller),
                  ),
                  if (controller.status == GameStatus.battle)
                    BattleOverlay(controller: controller),
                  if (controller.status == GameStatus.chestReward)
                    ChestRewardOverlay(controller: controller),
                  if (controller.status == GameStatus.inventoryFull)
                    InventorySwapOverlay(controller: controller),
                  if (controller.status == GameStatus.itemConfirm)
                    ItemConfirmPopup(controller: controller),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: DPad(controller: controller),
            ),
          ],
        ),
      ),
    );
  }

  void _checkForNotices(GameController controller) {
    if (!mounted) return;

    if (controller.hero.level > _lastKnownLevel) {
      _showBanner('レベルアップ！ Lv.${controller.hero.level}', Colors.amber.shade700);
    }
    _lastKnownLevel = controller.hero.level;

    if (controller.message.isNotEmpty && controller.message != _lastShownMessage) {
      _showBanner(controller.message, Colors.deepOrange);
      _lastShownMessage = controller.message;
    }
  }

  void _showBanner(String text, Color color) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(text, textAlign: TextAlign.center),
          backgroundColor: color,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
  }
}
