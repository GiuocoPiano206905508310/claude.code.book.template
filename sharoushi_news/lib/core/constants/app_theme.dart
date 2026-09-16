import 'package:flutter/material.dart';

/// 白ベース＋ネイビー／ブルー系アクセントの配色（仕様セクション20）。
/// 行政サイトそのものに見えないよう、公式ロゴや役所然とした意匠は使わない。
class AppColors {
  AppColors._();

  static const navy = Color(0xFF1E3A5F);
  static const navyDark = Color(0xFF15283F);
  static const accentBlue = Color(0xFF3E7CB1);

  static const importance3 = Color(0xFFB3382C); // 必ず確認
  static const importance2 = Color(0xFFA9761B); // 重要
  static const importance1 = Color(0xFF5B6472); // 参考

  static const importance3Bg = Color(0x1AB3382C);
  static const importance2Bg = Color(0x1AA9761B);
  static const importance1Bg = Color(0x145B6472);
}

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.navy,
      brightness: Brightness.light,
      primary: AppColors.navy,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: 'Noto Sans JP',
      scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFFF7F8FA),
        foregroundColor: AppColors.navyDark,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE4E7EC)),
        ),
        margin: EdgeInsets.zero,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.navy,
        unselectedItemColor: const Color(0xFF9AA2AE),
        type: BottomNavigationBarType.fixed,
      ),
      dividerColor: const Color(0xFFE4E7EC),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.accentBlue,
      brightness: Brightness.dark,
      primary: AppColors.accentBlue,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: 'Noto Sans JP',
      scaffoldBackgroundColor: const Color(0xFF14181E),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF14181E),
        foregroundColor: Color(0xFFECEEF1),
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: const Color(0xFF1C222B),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFF2A313C)),
        ),
        margin: EdgeInsets.zero,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF1C222B),
        selectedItemColor: AppColors.accentBlue,
        unselectedItemColor: Color(0xFF7C8794),
        type: BottomNavigationBarType.fixed,
      ),
      dividerColor: const Color(0xFF2A313C),
    );
  }
}
