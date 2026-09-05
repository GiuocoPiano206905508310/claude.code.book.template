import 'dart:math';

/// Seedable random number source used for every randomized game decision
/// (loot rolls, trap checks, fruit stat gains). Abstracted behind this
/// class so tests can construct it with a fixed seed and get fully
/// deterministic, reproducible results.
///
/// [drawCount] tracks how many random draws have happened since the seed
/// was set, so a save file can store `(seed, drawCount)` and resume the
/// exact same random stream on load instead of re-rolling decisions that
/// already happened (e.g. re-drawing a chest that was already opened).
class RandomService {
  final int seed;
  int _drawCount;
  late Random _random;

  RandomService({required this.seed, int drawCount = 0})
    : _drawCount = drawCount {
    _random = Random(seed);
    for (var i = 0; i < drawCount; i++) {
      _random.nextDouble();
    }
  }

  /// Creates a service seeded from the current wall-clock time, for normal
  /// (non-test) play.
  factory RandomService.fromTime() =>
      RandomService(seed: DateTime.now().millisecondsSinceEpoch);

  int get drawCount => _drawCount;

  /// Returns a double in `[0, 1)`.
  double nextDouble() {
    _drawCount++;
    return _random.nextDouble();
  }

  /// Returns an integer in `[min, max]` (inclusive on both ends).
  int nextIntInRange(int min, int max) {
    return min + (nextDouble() * (max - min + 1)).floor();
  }

  /// Picks an entry from a weighted table. [weights] must be non-empty and
  /// every weight must be > 0; weights do not need to sum to 1.
  T pickWeighted<T>(List<T> items, List<double> weights) {
    assert(items.isNotEmpty && items.length == weights.length);
    final total = weights.fold<double>(0, (sum, w) => sum + w);
    final roll = nextDouble() * total;
    var cumulative = 0.0;
    for (var i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return items[i];
    }
    return items.last;
  }

  /// Returns `true` with probability [chance] (0.0-1.0).
  bool rollChance(double chance) => nextDouble() < chance;
}
