import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hero_quest/data/master/stage_registry.dart';
import 'package:hero_quest/data/save/save_repository.dart';
import 'package:hero_quest/domain/models/hero_state.dart';
import 'package:hero_quest/domain/models/save_data.dart';
import 'package:hero_quest/domain/models/stage.dart';
import 'package:hero_quest/domain/models/tile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  SaveData buildSample() {
    final stage = StageRegistry.first;
    return SaveData(
      stageId: stage.id,
      hero: HeroState.initial().copyWith(level: 3, exp: 5, currentHp: 7),
      stageState: StageState.initial(stage),
      rngSeed: 12345,
      rngDrawCount: 8,
      updatedAt: DateTime.utc(2026, 1, 1),
    );
  }

  test('セーブ→ロードで進行状態が一致する', () async {
    final repo = SaveRepository();
    final original = buildSample();

    await repo.save(original);
    final loaded = await repo.load();

    expect(loaded, isNotNull);
    expect(loaded!.stageId, original.stageId);
    expect(loaded.hero.level, original.hero.level);
    expect(loaded.hero.exp, original.hero.exp);
    expect(loaded.hero.currentHp, original.hero.currentHp);
    expect(loaded.rngSeed, original.rngSeed);
    expect(loaded.rngDrawCount, original.rngDrawCount);
    expect(loaded.stageState.heroPosition, original.stageState.heroPosition);
  });

  test('宝箱の内容とトラップ判定はセーブ→ロードで再抽選されない', () async {
    final repo = SaveRepository();
    final stage = StageRegistry.first;
    var stageState = StageState.initial(stage);
    final chestTile = stage.tiles.firstWhere((t) => t.kind == TileKind.chest);
    stageState = stageState.withTileState(
      chestTile.position,
      stageState.tileStateAt(chestTile.position).copyWith(
            chestOpened: true,
            chestItemId: 'heal_potion_s',
            chestIsTrap: false,
          ),
    );

    final saveData = SaveData(
      stageId: stage.id,
      hero: HeroState.initial(),
      stageState: stageState,
      rngSeed: 1,
      rngDrawCount: 3,
      updatedAt: DateTime.utc(2026, 1, 1),
    );
    await repo.save(saveData);
    final loaded = await repo.load();

    final loadedChestState = loaded!.stageState.tileStateAt(chestTile.position);
    expect(loadedChestState.chestOpened, isTrue);
    expect(loadedChestState.chestItemId, 'heal_potion_s');
    expect(loadedChestState.chestIsTrap, isFalse);
  });

  test('セーブが存在しない場合はnullを返す', () async {
    final repo = SaveRepository();
    expect(await repo.load(), isNull);
    expect(await repo.hasSave(), isFalse);
  });

  test('破損したセーブデータは例外を投げ、クラッシュしない', () async {
    SharedPreferences.setMockInitialValues({
      'hero_quest_save_v1': '{ this is not valid json ',
    });
    final repo = SaveRepository();

    expect(repo.load(), throwsA(isA<SaveCorruptedException>()));
  });

  test('削除するとセーブが無い状態に戻る', () async {
    final repo = SaveRepository();
    await repo.save(buildSample());
    expect(await repo.hasSave(), isTrue);

    await repo.delete();
    expect(await repo.hasSave(), isFalse);
  });
}
