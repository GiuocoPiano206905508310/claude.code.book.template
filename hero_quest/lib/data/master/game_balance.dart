/// Central place for every tunable number in the game.
///
/// MVP時点では未確定の値が多いため、ここを編集するだけでゲームバランスを
/// 調整できるようにしている（コード内に数値を散在させない）。
/// 各定数のコメントに「仮設定」と書かれている値は、正式仕様が決まったら
/// このファイルの値だけを変更すればよい。
class GameBalance {
  const GameBalance._();

  // --- 勇者の初期能力 ---
  static const int initialMaxHp = 10;
  static const int initialAttack = 3;
  static const int initialDefense = 1;

  // --- レベル・経験値 (仮設定) ---
  static const int levelCap = 50;
  static const int hpGainPerLevel = 2;
  static const int attackGainPerLevel = 1;

  /// 防御力は偶数レベル到達時のみ +1。
  static const int defenseGainOnEvenLevel = 1;

  static const int normalEnemyExp = 3;
  static const int bossEnemyExp = 10;

  /// 次レベルに必要な経験値 = 10 + (現在レベル-1) × 5 (仮設定)
  static int expToNextLevel(int currentLevel) => 10 + (currentLevel - 1) * 5;

  // --- 戦闘 ---
  /// 最低ダメージ。仕様上は1固定だが、設定で0に変更可能にしている。
  static const int minimumDamage = 1;

  // --- インベントリ ---
  static const int inventorySlotCount = 3;

  // --- 宝箱 (仮設定) ---
  /// 道中宝箱のサイズ抽選比率。
  static const double smallChestWeight = 0.70;
  static const double mediumChestWeight = 0.30;

  /// トラップ発生率。
  static const double smallChestTrapRate = 0.10;
  static const double mediumChestTrapRate = 0.15;

  /// トラップ発動時のダメージ。
  static const int smallChestTrapDamage = 2;
  static const int mediumChestTrapDamage = 4;

  // --- ギミック ---
  /// ダメージ床のデフォルトダメージ量（タイル側で上書き可能）。
  static const int defaultDamageFloorAmount = 1;
}
