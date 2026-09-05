import 'position.dart';

/// The kind of a map tile.
enum TileKind { start, normal, enemy, chest, gimmick, goal }

/// Size of a treasure chest tile. Determines the loot table used and the
/// trap rate/damage.
enum ChestSize { small, medium, large }

/// The three MVP gimmick types. New gimmicks can be added by extending
/// this enum and handling the new case in `GimmickService` — the tile
/// model itself does not need to change.
enum GimmickType {
  /// Can only be exited in [TileDefinition.oneWayDirection].
  oneWay,

  /// Opens the door tile identified by [TileDefinition.switchId] once the
  /// hero steps onto this tile.
  switchTile,

  /// Blocks entry until the switch identified by
  /// [TileDefinition.switchId] has been triggered.
  doorTile,

  /// Deals damage once when the hero stops on this tile.
  damageFloor,
}

/// Fixed, author-time definition of a single map tile. Stage maps are
/// hand-authored as lists of these, which keeps the map data itself free
/// of any mutable/runtime state.
class TileDefinition {
  final Position position;

  /// Directions in which this tile connects to a neighboring tile that
  /// the hero can walk between (bidirectionally, unless restricted by a
  /// gimmick such as [GimmickType.oneWay]).
  final Set<Direction> connections;

  final TileKind kind;

  /// [TileKind.enemy] only.
  final String? enemyDefId;

  /// [TileKind.chest] only. Chest size is fixed at map-authoring time so
  /// it is never re-rolled on save/load.
  final ChestSize? chestSize;

  final GimmickType? gimmickType;

  /// [GimmickType.oneWay] only.
  final Direction? oneWayDirection;

  /// [GimmickType.switchTile] and [GimmickType.doorTile]: the shared id
  /// linking a switch to the door(s) it opens.
  final String? switchId;

  /// [GimmickType.damageFloor] only: overrides
  /// `GameBalance.defaultDamageFloorAmount` when set.
  final int? damageFloorAmount;

  const TileDefinition({
    required this.position,
    required this.connections,
    required this.kind,
    this.enemyDefId,
    this.chestSize,
    this.gimmickType,
    this.oneWayDirection,
    this.switchId,
    this.damageFloorAmount,
  });
}

/// Mutable runtime state for a tile, tracked per stage playthrough and
/// persisted in [SaveData].
class TileState {
  final bool visited;

  /// [TileKind.chest] only: whether it has already been opened.
  final bool chestOpened;

  /// [TileKind.chest] only: item id granted, decided once on first open
  /// and never re-rolled afterwards. Null for an unopened chest, or for a
  /// chest whose result was a trap.
  final String? chestItemId;

  /// [TileKind.chest] only: whether the (already-decided) result was a
  /// trap rather than an item.
  final bool chestIsTrap;

  /// [GimmickType.damageFloor] only: whether the damage has already been
  /// applied, so re-entering logic (if any) never double-applies it.
  final bool damageFloorTriggered;

  const TileState({
    this.visited = false,
    this.chestOpened = false,
    this.chestItemId,
    this.chestIsTrap = false,
    this.damageFloorTriggered = false,
  });

  TileState copyWith({
    bool? visited,
    bool? chestOpened,
    String? chestItemId,
    bool? chestIsTrap,
    bool? damageFloorTriggered,
  }) {
    return TileState(
      visited: visited ?? this.visited,
      chestOpened: chestOpened ?? this.chestOpened,
      chestItemId: chestItemId ?? this.chestItemId,
      chestIsTrap: chestIsTrap ?? this.chestIsTrap,
      damageFloorTriggered: damageFloorTriggered ?? this.damageFloorTriggered,
    );
  }

  Map<String, dynamic> toJson() => {
    'visited': visited,
    'chestOpened': chestOpened,
    'chestItemId': chestItemId,
    'chestIsTrap': chestIsTrap,
    'damageFloorTriggered': damageFloorTriggered,
  };

  factory TileState.fromJson(Map<String, dynamic> json) => TileState(
    visited: json['visited'] as bool? ?? false,
    chestOpened: json['chestOpened'] as bool? ?? false,
    chestItemId: json['chestItemId'] as String?,
    chestIsTrap: json['chestIsTrap'] as bool? ?? false,
    damageFloorTriggered: json['damageFloorTriggered'] as bool? ?? false,
  );
}
