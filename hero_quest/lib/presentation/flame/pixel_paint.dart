import 'dart:ui';

/// Nearest-neighbor sampling so the placeholder (and, later, real) pixel
/// art stays crisp instead of blurring when scaled to fit the screen.
Paint pixelPaint() => Paint()..filterQuality = FilterQuality.none;
