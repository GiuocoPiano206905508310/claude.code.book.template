import 'package:flutter/material.dart';

import '../../data/master/items.dart';
import '../../domain/game_controller.dart';
import '../../domain/models/hero_state.dart';

/// 現在HP/最大HP、レベル、攻撃力、防御力、所持アイテム3枠を表示する
/// ステージ画面のHUD。アイテム枠はタップでフィールド使用できる。
class HeroHud extends StatelessWidget {
  const HeroHud({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final hero = controller.hero;
    final canTap = controller.status == GameStatus.movable;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: Colors.indigo.shade50,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Lv.${hero.level}', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(width: 12),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: hero.baseMaxHp == 0 ? 0 : hero.currentHp / hero.baseMaxHp,
                    minHeight: 12,
                    backgroundColor: Colors.red.shade100,
                    color: Colors.green,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('HP ${hero.currentHp}/${hero.baseMaxHp}'),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text('攻撃力 ${hero.baseAttack}'),
              const SizedBox(width: 16),
              Text('防御力 ${hero.baseDefense}'),
              const Spacer(),
              ..._inventorySlots(context, hero, canTap),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _inventorySlots(BuildContext context, HeroState hero, bool canTap) {
    return List.generate(hero.inventory.length, (index) {
      final slot = hero.inventory[index];
      final def = slot == null ? null : ItemMaster.byIdOrThrow(slot.itemId);
      final usable = canTap && def != null && def.isFieldUsable;

      return Padding(
        padding: const EdgeInsets.only(left: 6),
        child: GestureDetector(
          onTap: usable ? () => controller.requestUseItem(index) : null,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.indigo.shade200),
              borderRadius: BorderRadius.circular(6),
              color: Colors.white,
            ),
            child: def == null
                ? null
                : Padding(
                    padding: const EdgeInsets.all(2),
                    child: Image.asset(
                      'assets/images/${def.imageId}.png',
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.none,
                    ),
                  ),
          ),
        ),
      );
    });
  }
}
