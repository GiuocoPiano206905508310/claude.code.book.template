import 'package:flutter_test/flutter_test.dart';
import 'package:hero_quest/domain/models/position.dart';
import 'package:hero_quest/domain/models/stage.dart';
import 'package:hero_quest/domain/models/tile.dart';
import 'package:hero_quest/domain/services/movement_service.dart';

void main() {
  const service = MovementService();

  StageDefinition buildLinearStage() {
    return StageDefinition(
      id: 'test',
      displayName: 'テスト',
      startPosition: const Position(0, 0),
      goalPosition: const Position(0, 2),
      tiles: [
        const TileDefinition(
          position: Position(0, 0),
          connections: {Direction.down},
          kind: TileKind.start,
        ),
        const TileDefinition(
          position: Position(0, 1),
          connections: {Direction.up, Direction.down},
          kind: TileKind.normal,
        ),
        const TileDefinition(
          position: Position(0, 2),
          connections: {Direction.up},
          kind: TileKind.goal,
        ),
      ],
    );
  }

  test('接続されていない方向へは移動できない', () {
    final stage = buildLinearStage();
    final state = StageState.initial(stage);

    final result = service.tryMove(stage, state, Direction.left);
    expect(result.allowed, isFalse);
    expect(result.rejectReason, MoveRejectReason.noConnection);
  });

  test('一度訪れたマスへは戻れない', () {
    final stage = buildLinearStage();
    var state = StageState.initial(stage);

    final forward = service.tryMove(stage, state, Direction.down);
    expect(forward.allowed, isTrue);
    state = state.copyWith(
      heroPosition: forward.newPosition!,
      tileStates: {
        ...state.tileStates,
        forward.newPosition!.key: state.tileStateAt(forward.newPosition!).copyWith(visited: true),
      },
    );

    final backward = service.tryMove(stage, state, Direction.up);
    expect(backward.allowed, isFalse);
    expect(backward.rejectReason, MoveRejectReason.alreadyVisited);
  });

  test('一方通行マスは矢印方向以外に出られない', () {
    final stage = StageDefinition(
      id: 'oneway-test',
      displayName: 'テスト',
      startPosition: const Position(1, 0),
      goalPosition: const Position(1, 1),
      tiles: [
        const TileDefinition(
          position: Position(1, 0),
          connections: {Direction.down, Direction.left, Direction.right},
          kind: TileKind.gimmick,
          gimmickType: GimmickType.oneWay,
          oneWayDirection: Direction.down,
        ),
        const TileDefinition(
          position: Position(1, 1),
          connections: {Direction.up},
          kind: TileKind.goal,
        ),
        const TileDefinition(
          position: Position(0, 0),
          connections: {Direction.right},
          kind: TileKind.normal,
        ),
        const TileDefinition(
          position: Position(2, 0),
          connections: {Direction.left},
          kind: TileKind.normal,
        ),
      ],
    );
    final state = StageState.initial(stage);

    final blocked = service.tryMove(stage, state, Direction.left);
    expect(blocked.allowed, isFalse);
    expect(blocked.rejectReason, MoveRejectReason.oneWayBlocked);

    final allowed = service.tryMove(stage, state, Direction.down);
    expect(allowed.allowed, isTrue);
  });

  test('閉じた扉には入れない', () {
    final stage = StageDefinition(
      id: 'door-test',
      displayName: 'テスト',
      startPosition: const Position(0, 0),
      goalPosition: const Position(0, 1),
      tiles: [
        const TileDefinition(
          position: Position(0, 0),
          connections: {Direction.down},
          kind: TileKind.start,
        ),
        const TileDefinition(
          position: Position(0, 1),
          connections: {Direction.up},
          kind: TileKind.gimmick,
          gimmickType: GimmickType.doorTile,
          switchId: 'sw1',
        ),
      ],
    );
    final state = StageState.initial(stage);

    final closed = service.tryMove(stage, state, Direction.down);
    expect(closed.allowed, isFalse);
    expect(closed.rejectReason, MoveRejectReason.doorClosed);

    final opened = state.withSwitchTriggered('sw1');
    final result = service.tryMove(stage, opened, Direction.down);
    expect(result.allowed, isTrue);
  });
}
