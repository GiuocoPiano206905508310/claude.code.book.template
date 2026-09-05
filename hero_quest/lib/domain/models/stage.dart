import 'enemy.dart';
import 'position.dart';
import 'tile.dart';

/// Fixed, hand-authored map data for one stage. Adding a new stage means
/// adding a new [StageDefinition] to the stage registry — no code changes
/// to game logic are needed.
class StageDefinition {
  final String id;
  final String displayName;
  final Position startPosition;
  final Position goalPosition;
  final List<TileDefinition> tiles;

  StageDefinition({
    required this.id,
    required this.displayName,
    required this.startPosition,
    required this.goalPosition,
    required this.tiles,
  }) : _byPosition = {for (final t in tiles) t.position.key: t};

  final Map<String, TileDefinition> _byPosition;

  TileDefinition? tileAt(Position position) => _byPosition[position.key];

  int get width => tiles.map((t) => t.position.x).reduce((a, b) => a > b ? a : b) + 1;

  int get height => tiles.map((t) => t.position.y).reduce((a, b) => a > b ? a : b) + 1;
}

/// Mutable, per-playthrough progress for a stage: tile states, enemy
/// states, gimmick switch states and the hero's current/previous
/// position on the grid. Fully serializable for save/load.
class StageState {
  final String stageId;
  final Map<String, TileState> tileStates;
  final Map<String, EnemyState> enemyStates;
  final Map<String, bool> switchStates;
  final Position heroPosition;
  final Position? previousPosition;

  const StageState({
    required this.stageId,
    required this.tileStates,
    required this.enemyStates,
    required this.switchStates,
    required this.heroPosition,
    this.previousPosition,
  });

  factory StageState.initial(StageDefinition definition) {
    final tileStates = <String, TileState>{
      definition.startPosition.key: const TileState(visited: true),
    };
    final enemyStates = <String, EnemyState>{
      for (final tile in definition.tiles)
        if (tile.kind == TileKind.enemy && tile.enemyDefId != null)
          tile.position.key: EnemyState(enemyDefId: tile.enemyDefId!),
    };
    return StageState(
      stageId: definition.id,
      tileStates: tileStates,
      enemyStates: enemyStates,
      switchStates: const {},
      heroPosition: definition.startPosition,
      previousPosition: null,
    );
  }

  TileState tileStateAt(Position position) =>
      tileStates[position.key] ?? const TileState();

  bool isSwitchTriggered(String switchId) => switchStates[switchId] ?? false;

  StageState copyWith({
    Map<String, TileState>? tileStates,
    Map<String, EnemyState>? enemyStates,
    Map<String, bool>? switchStates,
    Position? heroPosition,
    Position? previousPosition,
    bool clearPreviousPosition = false,
  }) {
    return StageState(
      stageId: stageId,
      tileStates: tileStates ?? this.tileStates,
      enemyStates: enemyStates ?? this.enemyStates,
      switchStates: switchStates ?? this.switchStates,
      heroPosition: heroPosition ?? this.heroPosition,
      previousPosition: clearPreviousPosition
          ? null
          : (previousPosition ?? this.previousPosition),
    );
  }

  StageState withTileState(Position position, TileState state) {
    return copyWith(tileStates: {...tileStates, position.key: state});
  }

  StageState withEnemyState(Position position, EnemyState state) {
    return copyWith(enemyStates: {...enemyStates, position.key: state});
  }

  StageState withSwitchTriggered(String switchId) {
    return copyWith(switchStates: {...switchStates, switchId: true});
  }

  Map<String, dynamic> toJson() => {
    'stageId': stageId,
    'tileStates': tileStates.map((k, v) => MapEntry(k, v.toJson())),
    'enemyStates': enemyStates.map((k, v) => MapEntry(k, v.toJson())),
    'switchStates': switchStates,
    'heroPosition': heroPosition.toJson(),
    'previousPosition': previousPosition?.toJson(),
  };

  factory StageState.fromJson(Map<String, dynamic> json) {
    final rawTileStates = json['tileStates'] as Map<String, dynamic>;
    final rawEnemyStates = json['enemyStates'] as Map<String, dynamic>;
    return StageState(
      stageId: json['stageId'] as String,
      tileStates: rawTileStates.map(
        (k, v) => MapEntry(k, TileState.fromJson(v as Map<String, dynamic>)),
      ),
      enemyStates: rawEnemyStates.map(
        (k, v) => MapEntry(k, EnemyState.fromJson(v as Map<String, dynamic>)),
      ),
      switchStates: (json['switchStates'] as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, v as bool),
      ),
      heroPosition: Position.fromJson(
        json['heroPosition'] as Map<String, dynamic>,
      ),
      previousPosition: json['previousPosition'] == null
          ? null
          : Position.fromJson(json['previousPosition'] as Map<String, dynamic>),
    );
  }
}
