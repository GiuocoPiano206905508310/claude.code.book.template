import 'package:flutter/material.dart';

/// 名前とHPを表示し、値が変化した瞬間だけ短く色が点滅する
/// （ダメージ／回復の簡易視覚効果）。
class HpBadge extends StatefulWidget {
  const HpBadge({super.key, required this.label, required this.hp, required this.maxHp});

  final String label;
  final int hp;
  final int maxHp;

  @override
  State<HpBadge> createState() => _HpBadgeState();
}

class _HpBadgeState extends State<HpBadge> {
  Color? _flashColor;

  @override
  void didUpdateWidget(covariant HpBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.hp != widget.hp) {
      _flashColor = widget.hp < oldWidget.hp ? Colors.red.shade200 : Colors.green.shade200;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(widget.label, style: const TextStyle(fontWeight: FontWeight.bold)),
        TweenAnimationBuilder<double>(
          key: ValueKey(widget.hp),
          tween: Tween(begin: _flashColor == null ? 0.0 : 1.0, end: 0.0),
          duration: const Duration(milliseconds: 500),
          builder: (context, t, child) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Color.lerp(Colors.transparent, _flashColor ?? Colors.transparent, t),
                borderRadius: BorderRadius.circular(6),
              ),
              child: child,
            );
          },
          child: Text('HP ${widget.hp}/${widget.maxHp}'),
        ),
      ],
    );
  }
}
