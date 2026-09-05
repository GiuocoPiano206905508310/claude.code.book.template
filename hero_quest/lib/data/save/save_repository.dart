import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/models/save_data.dart';

/// Thrown by [SaveRepository.load] when a save exists but cannot be
/// parsed. Distinct from returning `null` (no save at all) so the UI can
/// show a "セーブデータが壊れています" message instead of silently
/// treating a broken save as "no save".
class SaveCorruptedException implements Exception {
  final String message;

  const SaveCorruptedException(this.message);

  @override
  String toString() => message;
}

/// Local, on-device persistence for [SaveData], stored as a single
/// versioned JSON string via `shared_preferences`.
class SaveRepository {
  static const _storageKey = 'hero_quest_save_v1';

  Future<void> save(SaveData data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(data.toJson()));
  }

  /// Returns `null` if there is no save yet. Throws
  /// [SaveCorruptedException] if a save exists but cannot be parsed.
  Future<SaveData?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null) return null;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return SaveData.fromJson(json);
    } catch (e) {
      throw SaveCorruptedException('セーブデータの読み込みに失敗しました: $e');
    }
  }

  Future<bool> hasSave() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_storageKey);
  }

  Future<void> delete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}
