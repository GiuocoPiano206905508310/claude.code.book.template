import 'package:flutter/material.dart';

/// A chunky, glossy "brick" surface: a running-bond brick-wall texture
/// (offset rows of mini bricks separated by mortar seams) painted inside a
/// rounded block, with a soft gloss streak near the top-left — used for
/// puzzle piece cells and stage select tiles so both read as illustrated
/// clay/brick blocks rather than flat colored squares.
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
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.16),
            blurRadius: 3,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: CustomPaint(
          painter: _BrickWallPainter(
            color: color,
            borderRadius: borderRadius,
            lineWidth: borderWidth,
          ),
          child: Stack(
            children: [
              Positioned.fill(
                child: Align(
                  alignment: const Alignment(-0.4, -0.6),
                  child: FractionallySizedBox(
                    widthFactor: 0.5,
                    heightFactor: 0.2,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: Colors.white.withValues(alpha: 0.26),
                      ),
                    ),
                  ),
                ),
              ),
              if (child != null) Center(child: child),
            ],
          ),
        ),
      ),
    );
  }
}

/// Paints a small running-bond brick-wall texture — rows of bricks whose
/// vertical seams are offset from the row above/below, like real brickwork
/// — instead of a single flat-colored square.
class _BrickWallPainter extends CustomPainter {
  final Color color;
  final double borderRadius;
  final double lineWidth;

  _BrickWallPainter({
    required this.color,
    required this.borderRadius,
    required this.lineWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final highlight = Color.lerp(color, Colors.white, 0.45)!;
    final shadow = Color.lerp(color, Colors.black, 0.28)!;
    final mortar = Color.lerp(color, Colors.black, 0.45)!;

    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [highlight, color, shadow],
          stops: const [0.0, 0.5, 1.0],
        ).createShader(rect),
    );

    final seamPaint = Paint()
      ..color = mortar
      ..strokeWidth = lineWidth
      ..strokeCap = StrokeCap.round;

    // 3 staggered rows (2 bricks / 3 bricks / 2 bricks) on regular-sized
    // cells; a simpler 2-row split on tiny tray-sized cells so the seams
    // stay legible instead of turning into mud.
    final rows = size.shortestSide >= 22 ? 3 : 2;
    final rowHeight = size.height / rows;
    final List<List<double>> dividersByRow = rows == 3
        ? const [
            [0.5],
            [1 / 3, 2 / 3],
            [0.5],
          ]
        : const [
            [0.5],
            <double>[],
          ];

    for (var r = 0; r < rows; r++) {
      final top = rowHeight * r;
      if (r > 0) {
        canvas.drawLine(Offset(0, top), Offset(size.width, top), seamPaint);
      }
      for (final fraction in dividersByRow[r]) {
        final x = size.width * fraction;
        canvas.drawLine(Offset(x, top), Offset(x, top + rowHeight), seamPaint);
      }
    }

    final inset = lineWidth / 2;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        rect.deflate(inset),
        Radius.circular((borderRadius - inset).clamp(0, borderRadius)),
      ),
      Paint()
        ..color = mortar
        ..style = PaintingStyle.stroke
        ..strokeWidth = lineWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _BrickWallPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.borderRadius != borderRadius ||
      oldDelegate.lineWidth != lineWidth;
}
