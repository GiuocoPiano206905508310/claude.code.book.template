import 'package:flutter/material.dart';

/// A chunky, glossy "brick" surface: a rounded block with a diagonal
/// highlight-to-shadow gradient, a darker mortar-like border, and a soft
/// gloss streak near the top-left — used for puzzle piece cells and stage
/// select tiles so both read as illustrated clay/brick blocks rather than
/// flat colored squares.
class BrickSurface extends StatelessWidget {
  final Color color;
  final double borderRadius;
  final double borderWidth;
  final Widget? child;

  const BrickSurface({
    super.key,
    required this.color,
    this.borderRadius = 10,
    this.borderWidth = 2.5,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    final highlight = Color.lerp(color, Colors.white, 0.45)!;
    final shadow = Color.lerp(color, Colors.black, 0.28)!;
    final mortar = Color.lerp(color, Colors.black, 0.42)!;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: mortar, width: borderWidth),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [highlight, color, shadow],
          stops: const [0.0, 0.5, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.16),
            blurRadius: 3,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: Align(
              alignment: const Alignment(-0.35, -0.55),
              child: FractionallySizedBox(
                widthFactor: 0.55,
                heightFactor: 0.28,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: Colors.white.withValues(alpha: 0.3),
                  ),
                ),
              ),
            ),
          ),
          if (child != null) Center(child: child),
        ],
      ),
    );
  }
}
