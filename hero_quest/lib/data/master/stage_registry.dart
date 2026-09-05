import '../../domain/models/stage.dart';
import 'stages/stage1.dart';
import 'stages/stage2_sample.dart';

/// Ordered list of every stage in the game. Adding a stage means adding a
/// new `buildStageN()` function under `stages/` and registering it here —
/// no other code changes are required.
class StageRegistry {
  const StageRegistry._();

  static final List<StageDefinition> _stages = [
    buildStage1(),
    buildStage2Sample(),
  ];

  static List<StageDefinition> get all => _stages;

  static StageDefinition byId(String id) =>
      _stages.firstWhere((s) => s.id == id);

  static StageDefinition get first => _stages.first;

  /// Returns the stage that follows [stageId], or `null` if it was the
  /// last one (current end of MVP content).
  static StageDefinition? next(String stageId) {
    final index = _stages.indexWhere((s) => s.id == stageId);
    if (index == -1 || index + 1 >= _stages.length) return null;
    return _stages[index + 1];
  }
}
