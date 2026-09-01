# 錯視迷宮の勇者(だまし絵ダンジョン)

Unity製・見下ろし視点のアクションパズルゲーム。デザイン画帳(勇者・建物・モンスター・仕掛け・アイテム・全体マップ)は確定済みです。このフォルダには、実装順序の**ステップ2「勇者の移動とカメラ」**までのソースコードが入っています。

## 現在の実装状況

- ✅ 4方向・90度ずつ切り替わるアイソメトリックカメラ(`IsoCameraRig`)
- ✅ カメラの向きを基準にした勇者の移動・旋回(`PlayerController`)
- ✅ 重力面(床／壁／天井)を切り替える仕組みの土台(`GravityFace`)。実際の重力反転床・反転梯子ギミックは未実装(ステップ6・7で追加予定)
- ✅ PCキーボード入力(`KeyboardMovementInput`)。矢印キー/WASDはUnityの既定のHorizontal/Verticalに両方バインドされているため追加設定不要
- ✅ アニメーション状態をAnimatorへ橋渡しする仕組み(`PlayerAnimatorLink`)
- ⬜ HP・ダメージ・ゲームオーバー(ステップ3)
- ⬜ 小宝箱・回復薬・盾(ステップ4)
- ⬜ モンスターAI・戦闘(ステップ5)
- ⬜ ステージ1の建物・仕掛け実体化(ステップ6)
- ⬜ スマートフォンのタッチ操作(`IMovementInput`の別実装を追加すればよい設計にしてあります)

Unityエディタでシーン(.unityファイル)を直接生成すると壊れたファイルになるリスクが高いため、シーンはこちらでは作らず、**下記の手順でエディタ上に組んでください**(5分程度です)。

## 開く手順

1. Unity Hub → 「開く」→ このフォルダ(`illusion-maze-dungeon`)を選択
2. `ProjectSettings/ProjectVersion.txt` は Unity 2022.3 LTS 系を指定しています。お手元のバージョンが異なる場合は、このファイルの `m_EditorVersion` をお使いのバージョンに書き換えるか、Unity Hubの「別バージョンで開く」を使ってください(2022.3以降のLTSであれば問題なく動くはずです)
3. 初回は `ProjectSettings` の不足ファイルをUnityが自動生成します

## シーンの組み方

1. `File > New Scene` で新規シーンを作成し、`Assets/Scenes/Stage1.unity` として保存
2. 空のGameObjectを作成し `Player` と名付ける
   - `Player` に `KeyboardMovementInput` と `PlayerController` をアタッチ
   - `PlayerController` の `Input Source` に、同じGameObjectの `KeyboardMovementInput` をドラッグ&ドロップ
   - 見た目用の子オブジェクト(勇者のモデル/スプライト)を配置し、`PlayerAnimatorLink` をアタッチしたい場合はAnimatorも一緒に
3. `Main Camera` を選ぶか新規作成し、空の親GameObject `CameraRig` を作成してその子にする
   - `CameraRig` に `IsoCameraRig` をアタッチ
   - `Focus` に `Player` をドラッグ&ドロップ
4. `PlayerController` の `Camera Rig` に `CameraRig` をドラッグ&ドロップ(カメラ基準の移動に必要)
5. 床・壁・天井になるブロックに `Collider` を付け、`PlayerController` の `Ground Mask` で拾えるレイヤーに設定(`SnapToSurface` が接地に使います)
6. 再生してWASD/矢印キーで動作確認

## 操作(PC)

| キー | 動作 |
|---|---|
| 矢印キー / WASD | 移動 |
| E | 調べる |
| Q | 回復薬を使う |
| R | 盾を使う |

カメラの90度回転は、デザイン上どのキーにも割り当てられていません(モバイルでは画面ボタン想定のため)。`IsoCameraRig.RotateClockwise()` / `RotateCounterClockwise()` をUIボタンのOnClickに割り当てて使ってください。

## 重力反転の使い方(将来のギミック実装向け)

`PlayerController.SetGravityFace(GravityFace face)` を呼ぶと、指定した面(床・天井・東西南北の壁)へ短い移行アニメーションとともに勇者が「起立」します。反転梯子・重力反転床のスクリプトは、この関数を呼ぶだけで組み込めるように設計しています。
