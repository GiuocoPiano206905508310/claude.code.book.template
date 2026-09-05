import 'hero_state.dart';
import 'stage.dart';

/// Versioned, fully-persistable snapshot of a playthrough.
///
/// The `schemaVersion` lets us evolve the save format later (add fields,
/// migrate old saves) without breaking existing save files.
class SaveData {
  static const int currentSchemaVersion = 1;

  final int schemaVersion;
  final String stageId;
  final HeroState hero;
  final StageState stageState;

  /// Seed and draw-count of the RNG stream, so loading a save resumes the
  /// exact same random sequence instead of re-rolling anything.
  final int rngSeed;
  final int rngDrawCount;

  final DateTime updatedAt;

  const SaveData({
    this.schemaVersion = currentSchemaVersion,
    required this.stageId,
    required this.hero,
    required this.stageState,
    required this.rngSeed,
    required this.rngDrawCount,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() => {
    'schemaVersion': schemaVersion,
    'stageId': stageId,
    'hero': hero.toJson(),
    'stageState': stageState.toJson(),
    'rngSeed': rngSeed,
    'rngDrawCount': rngDrawCount,
    'updatedAt': updatedAt.toIso8601String(),
  };

  /// Throws [FormatException] on any structural problem so the caller can
  /// show a "save data is corrupted" screen instead of crashing.
  factory SaveData.fromJson(Map<String, dynamic> json) {
    final version = json['schemaVersion'];
    if (version is! int || version > currentSchemaVersion) {
      throw const FormatException('unsupported save schema version');
    }
    return SaveData(
      schemaVersion: version,
      stageId: json['stageId'] as String,
      hero: HeroState.fromJson(json['hero'] as Map<String, dynamic>),
      stageState: StageState.fromJson(
        json['stageState'] as Map<String, dynamic>,
      ),
      rngSeed: json['rngSeed'] as int,
      rngDrawCount: json['rngDrawCount'] as int,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
