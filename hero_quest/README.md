# Hero Quest（MVP）

1マスずつ進む勇者を操作し、分岐するコース上の敵・宝箱・トラップ・ギミックを
攻略してゴールの大宝箱を目指す、スマホ向け2Dドット絵RPGのMVP（試作版）です。
Flutter（安定版）+ [Flame](https://flame-engine.org/) で実装しています。

## 目次

- [環境構築](#環境構築)
- [起動方法](#起動方法)
- [テスト](#テスト)
- [静的解析](#静的解析)
- [ビルド方法](#ビルド方法)
- [フォルダ構成](#フォルダ構成)
- [マスターデータの編集場所](#マスターデータの編集場所)
- [仮設定（MVP時点の未確定値）一覧](#仮設定mvp時点の未確定値一覧)
- [既知の制限・未実装事項](#既知の制限未実装事項)
- [正式素材を入れる際の画像一覧](#正式素材を入れる際の画像一覧)

## 環境構築

1. [Flutter SDK（安定版）](https://docs.flutter.dev/get-started/install) をインストールします。
   本プロジェクトは Flutter 3.35 系 / Dart 3.9 系で動作確認しています。
2. 依存パッケージを取得します。

   ```bash
   cd hero_quest
   flutter pub get
   ```

3. `flutter doctor` で iOS/Android のビルド環境（Xcode / Android Studio）が
   整っているか確認してください。実機・エミュレータでの動作確認にはこれらが
   必要です（本リポジトリのCI/開発コンテナ内では Android SDK 等が無いため、
   `flutter analyze` と `flutter test` のみで検証しています）。

## 起動方法

接続済みの実機、またはAndroid/iOSエミュレータ・シミュレータがある状態で:

```bash
cd hero_quest
flutter run
```

アプリは縦画面固定で起動し、タイトル画面が表示されます。

- 「はじめから」: レベル1・初期能力で新規開始します。
- 「つづきから」: セーブデータがある場合のみ有効です。
- 「セーブデータ削除」: 確認ダイアログの後、セーブデータを削除します。

## テスト

ロジックはUIから分離しており（`lib/domain/`）、`flutter test` で以下を検証します。

```bash
cd hero_quest
flutter test
```

- ダメージ計算（最低ダメージ・0設定含む）
- 先制撃破時に敵が反撃しないこと
- 盾の自動発動・武器/盾の1戦闘1回制限
- アイテムの消費・回復薬の上限クランプ
- 所持枠3つの上限・満杯時の入れ替え/取得拒否
- 小・中・大宝箱の抽選重み（統計検証）とトラップ非再抽選
- 後戻り禁止・未接続方向への移動禁止
- レベルアップ時の能力上昇
- セーブ→ロードの一致、破損セーブデータの安全な処理
- タイトル→ステージ画面遷移のスモークテスト（Flameのゲーム画面を含む）

## 静的解析

```bash
cd hero_quest
flutter analyze
```

## ビルド方法

```bash
# Android (APK)
flutter build apk

# iOS（macOS + Xcode環境が必要）
flutter build ios
```

## フォルダ構成

```
lib/
  data/
    master/            # マスターデータ（敵・アイテム・宝箱抽選・ステージ・数値設定）
      game_balance.dart # 数値設定を集約（レベル/経験値/最低ダメージ/宝箱確率など）
      enemies.dart       # 敵マスター
      items.dart         # アイテムマスター
      loot_tables.dart   # 宝箱の重み付き抽選テーブル
      stage_registry.dart
      stages/            # ステージごとの固定マップ定義
    save/
      save_repository.dart # ローカル保存（SharedPreferences + バージョン付きJSON）
  domain/
    models/             # HeroState / EnemyDefinition・State / ItemDefinition・
                         # InventoryItem / StageDefinition・State /
                         # TileDefinition・State / BattleState / SaveData など
    services/           # 移動判定・戦闘・レベル・宝箱抽選・ギミック・
                         # アイテム効果・乱数(RandomService)
    game_controller.dart # UI非依存の状態機械（ChangeNotifier）
  presentation/
    screens/            # タイトル/ステージ/ステージクリア/ゲームオーバー
    overlays/            # 戦闘・宝箱獲得・入れ替え・使用確認
    widgets/             # 十字キー・HUD・ステージボードのラッパー
    flame/               # Flameのゲーム本体・タイル/勇者コンポーネント
assets/images/          # 仮ドット絵プレースホルダー（64×64 PNG）
test/                   # ロジック単体テスト + 画面遷移スモークテスト
```

ゲームロジック（`domain/`）・表示（`presentation/`）・保存処理
（`data/save/`）・マスターデータ（`data/master/`）を分離しているため、
新しいステージ・敵・アイテムは基本的に `data/master/` 配下への
データ追加だけで増やせます。

## マスターデータの編集場所

| 内容 | ファイル |
|---|---|
| 数値バランス全般（レベル/経験値/最低ダメージ/インベントリ枠数/宝箱確率など） | `lib/data/master/game_balance.dart` |
| 敵の能力・経験値・ボス判定 | `lib/data/master/enemies.dart` |
| アイテムの効果・入手元カテゴリ | `lib/data/master/items.dart` |
| 宝箱の中身抽選テーブル（小・中・大） | `lib/data/master/loot_tables.dart` |
| ステージのマス配置・分岐・ギミック・敵/宝箱配置 | `lib/data/master/stages/*.dart` |
| ステージの登場順（ステージ追加時はここに登録） | `lib/data/master/stage_registry.dart` |

新しいギミック種別を追加する場合は `lib/domain/models/tile.dart` の
`GimmickType` に列挙値を追加し、`lib/domain/services/gimmick_service.dart` に
`GimmickHandler` の実装を1つ追加して登録するだけで済むように設計しています。

## 仮設定（MVP時点の未確定値）一覧

指示書で「未確定・仮設定」とされていた値は、すべて
`lib/data/master/game_balance.dart` および `lib/data/master/loot_tables.dart`
に集約しています。正式な数値が決まったら、以下の値をこの2ファイルで
変更してください（コード内の他の場所を探す必要はありません）。

| 項目 | 現在の仮設定値 | 変更場所 |
|---|---|---|
| 次レベル必要経験値 | `10 + (現在レベル-1) × 5` | `GameBalance.expToNextLevel()` |
| レベルアップ時の上昇量 | 最大HP+2、攻撃力+1、防御力は偶数レベルのみ+1 | `GameBalance.hpGainPerLevel` 等 |
| ボス/通常敵の経験値 | ボス10、通常3 | `GameBalance.bossEnemyExp` / `normalEnemyExp` |
| レベル上限 | 50 | `GameBalance.levelCap` |
| 最低ダメージ | 1（0に変更可能な設計） | `GameBalance.minimumDamage` |
| 道中宝箱サイズ比率 | 小70%・中30% | `GameBalance.smallChestWeight` 等（※本MVPは固定マップのため各宝箱のサイズは`stages/*.dart`側で直接指定。比率は将来の自動生成用） |
| トラップ率 | 小10%・中15% | `GameBalance.smallChestTrapRate` 等 |
| トラップダメージ | 小2・中4 | `GameBalance.smallChestTrapDamage` 等 |
| 小・中宝箱の抽選重み | `loot_service_test.dart`で検証済みの重み | `LootTables.small` / `LootTables.medium` |
| 大宝箱のプラチナ枠 | プラチナの盾15%・プラチナの大剣15%、残り70%を5種均等(14%ずつ) | `LootTables.large` |
| 武器・盾の消費方法 | 1戦闘につき効果発動時に1個消費（耐久値制ではない）。武器は手動選択、盾は初被弾時に自動発動、いずれも1戦闘に1個まで | `lib/domain/services/battle_service.dart` |
| ゲームオーバー時の再開地点 | 直近のオートセーブ（戦闘開始直前の状態）から再開 | `GameController.retryFromLastSave()` |
| ダメージ床のダメージ量既定値 | 1 | `GameBalance.defaultDamageFloorAmount`（タイル単位で上書き可） |

## 既知の制限・未実装事項

- **実機/エミュレータ未検証**: 開発コンテナにAndroid SDK・Xcode・ブラウザが
  無いため、`flutter analyze` / `flutter test`（Flameの `GameWidget` を含む
  ウィジェットテスト）でのみ検証しています。実機での操作感・当たり判定・
  レイアウト崩れの最終確認が必要です。
- **先制・状態異常・逃走などの拡張戦闘要素**: 指示書どおりMVPでは未実装です
  （`BattleState`/`BattleService` は拡張しやすい形にしています）。
- **道中宝箱サイズの自動抽選（70%/30%）**: 現在のステージ1・2は固定マップの
  ため、各宝箱のサイズは `stages/*.dart` 側で直接指定しています。比率自体は
  `GameBalance` に定義済みなので、将来ステージを自動生成する場合はそこから
  利用できます。
- **効果音・BGM**: 未実装です。
- **ステージ3以降**: 未作成です（ステージ2はサンプルデータ）。
- ステージ1・2をクリアした後（最終ステージクリア後）は、指示書に無いため
  タイトル画面へ戻る仮仕様にしています。

## 正式素材を入れる際の画像一覧

すべて `assets/images/` 配下に、同名の64×64 PNG（1マス32×32相当の表示に対して
@2x で書き出したもの）として配置しています。ファイル名を変えずに正式な
ドット絵へ差し替えれば、コード変更なしで反映されます。

**タイル系**
`tile_floor` / `tile_start` / `tile_goal` / `tile_gimmick_oneway`（右向き基準。
コード側で上下左右に回転して使用） / `tile_gimmick_switch` /
`tile_gimmick_door_closed` / `tile_gimmick_door_open` /
`tile_gimmick_damagefloor` / `tile_chest_small` / `tile_chest_medium` /
`tile_chest_large` / `tile_chest_opened`

**勇者（向き別、4枚）**
`hero_up` / `hero_down` / `hero_left` / `hero_right`

**敵（5種）**
`enemy_slime` / `enemy_bat` / `enemy_monster_box` / `enemy_magic_book` /
`enemy_stone_statue`

**アイテム（17種）**
`item_heal_potion_s` / `item_heal_potion_m` / `item_heal_potion_l` /
`item_shield_wood` / `item_shield_iron` / `item_shield_bronze` /
`item_shield_silver` / `item_shield_gold` / `item_shield_platinum` /
`item_weapon_club` / `item_weapon_iron_hammer` / `item_weapon_bronze_spear` /
`item_weapon_silver_axe` / `item_weapon_gold_sword` /
`item_weapon_platinum_greatsword` / `item_fruit_hp` / `item_fruit_attack` /
`item_fruit_defense`

現在はPillowの図形描画（矩形・楕円・多角形の組み合わせ）でシルエットと
陰影を付けた仮ドット絵です。`tools/gen_placeholder_assets.py` で再生成・
調整できます。

```bash
cd hero_quest
pip install pillow
python3 tools/gen_placeholder_assets.py
```

マス目のドット感がぼやけないよう、表示側は最近傍補間
（`FilterQuality.none` / Flameコンポーネントの`paint`）を指定済みです。
