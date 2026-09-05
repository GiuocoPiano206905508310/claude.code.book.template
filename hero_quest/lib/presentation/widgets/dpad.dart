import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';
import '../../domain/models/position.dart';

/// 十字キー。分岐地点では、進める方向のボタンだけが有効化・強調表示
/// される（「分岐地点では、進める方向を視覚的に分かるようにする」）。
class DPad extends StatelessWidget {
  const DPad({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final available = controller.availableDirections;

    Widget button(Direction direction, IconData icon) {
      final enabled = available.contains(direction);
      return SizedBox(
        width: 52,
        height: 52,
        child: ElevatedButton(
          onPressed: enabled ? () => controller.move(direction) : null,
          style: ElevatedButton.styleFrom(
            shape: const CircleBorder(),
            backgroundColor: enabled ? Colors.indigo : Colors.grey.shade300,
            foregroundColor: Colors.white,
            elevation: enabled ? 4 : 0,
            padding: EdgeInsets.zero,
          ),
          child: Icon(icon, size: 28),
        ),
      );
    }

    return SizedBox(
      width: 176,
      height: 176,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(top: 0, child: button(Direction.up, Icons.keyboard_arrow_up)),
          Positioned(bottom: 0, child: button(Direction.down, Icons.keyboard_arrow_down)),
          Positioned(left: 0, child: button(Direction.left, Icons.keyboard_arrow_left)),
          Positioned(right: 0, child: button(Direction.right, Icons.keyboard_arrow_right)),
        ],
      ),
    );
  }
}
