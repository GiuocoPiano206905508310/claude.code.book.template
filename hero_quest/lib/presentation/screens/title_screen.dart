import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';

/// タイトル画面。「はじめから」「つづきから」（セーブデータがある
/// 場合のみ有効）「セーブデータ削除」を表示する。
class TitleScreen extends StatefulWidget {
  const TitleScreen({super.key, required this.controller});

  final GameController controller;

  @override
  State<TitleScreen> createState() => _TitleScreenState();
}

class _TitleScreenState extends State<TitleScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.checkForSave();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.indigo.shade900, Colors.indigo.shade400],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.castle, color: Colors.white, size: 64),
                const SizedBox(height: 16),
                Text(
                  'Hero Quest',
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 56),
                _TitleButton(label: 'はじめから', onTap: controller.startNewGame),
                const SizedBox(height: 16),
                _TitleButton(
                  label: 'つづきから',
                  onTap: controller.hasSaveFile ? () => controller.continueGame() : null,
                ),
                const SizedBox(height: 16),
                _TitleButton(
                  label: 'セーブデータ削除',
                  onTap: controller.hasSaveFile ? () => _confirmDelete(context, controller) : null,
                ),
                if (controller.loadError == LoadError.corrupted)
                  Padding(
                    padding: const EdgeInsets.only(top: 32),
                    child: Text(
                      'セーブデータの読み込みに失敗しました。\n「はじめから」で新規に開始してください。',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.yellow.shade200),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, GameController controller) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('確認'),
        content: const Text('セーブデータを削除します。よろしいですか？'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('キャンセル')),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              controller.deleteSave();
            },
            child: const Text('削除する'),
          ),
        ],
      ),
    );
  }
}

class _TitleButton extends StatelessWidget {
  const _TitleButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 48,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: Colors.indigo.shade900,
          disabledBackgroundColor: Colors.white24,
          disabledForegroundColor: Colors.white54,
        ),
        child: Text(label),
      ),
    );
  }
}
