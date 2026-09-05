import '../models/position.dart';
import '../models/stage.dart';
import '../models/tile.dart';

/// Why a requested move was rejected. Used by the UI to give the player
/// (or a test) a clear reason, and to decide whether to show a "can't go
/// back" hint versus just not drawing an arrow.
enum MoveRejectReason {
  noConnection,
  outOfBounds,
  alreadyVisited,
  doorClosed,
  oneWayBlocked,
}

class MoveResult {
  final bool allowed;
  final Position? newPosition;
  final MoveRejectReason? rejectReason;

  const MoveResult.allowed(Position position)
    : allowed = true,
      newPosition = position,
      rejectReason = null;

  const MoveResult.rejected(MoveRejectReason reason)
    : allowed = false,
      newPosition = null,
      rejectReason = reason;
}

/// Pure grid-movement rules: connectivity, map bounds, one-way gimmicks,
/// closed doors, and the "never step on a tile you've already visited"
/// no-backtracking rule. Contains no mutable state — every method takes
/// the current stage definition/state and returns a fresh result.
class MovementService {
  const MovementService();

  /// Directions the hero could move right now, ignoring the visited-tile
  /// rule violations that would still reject them individually — used by
  /// the UI to grey out D-pad buttons and highlight branch choices.
  List<Direction> availableDirections(
    StageDefinition stage,
    StageState state,
  ) {
    return Direction.values
        .where((d) => tryMove(stage, state, d).allowed)
        .toList();
  }

  MoveResult tryMove(StageDefinition stage, StageState state, Direction direction) {
    final current = stage.tileAt(state.heroPosition);
    if (current == null) {
      return const MoveResult.rejected(MoveRejectReason.outOfBounds);
    }

    // 一方通行マス: 矢印方向以外には出られない。
    if (current.gimmickType == GimmickType.oneWay &&
        current.oneWayDirection != null &&
        direction != current.oneWayDirection) {
      return const MoveResult.rejected(MoveRejectReason.oneWayBlocked);
    }

    if (!current.connections.contains(direction)) {
      return const MoveResult.rejected(MoveRejectReason.noConnection);
    }

    final targetPosition = state.heroPosition.moved(direction);
    final target = stage.tileAt(targetPosition);
    if (target == null || !target.connections.contains(direction.opposite)) {
      return const MoveResult.rejected(MoveRejectReason.outOfBounds);
    }

    if (target.kind == TileKind.gimmick &&
        target.gimmickType == GimmickType.doorTile) {
      final isOpen = target.switchId != null &&
          state.isSwitchTriggered(target.switchId!);
      if (!isOpen) {
        return const MoveResult.rejected(MoveRejectReason.doorClosed);
      }
    }

    if (state.tileStateAt(targetPosition).visited) {
      return const MoveResult.rejected(MoveRejectReason.alreadyVisited);
    }

    return MoveResult.allowed(targetPosition);
  }
}
