import 'package:flutter/material.dart';

import '../../domain/game_controller.dart';

/// ゲームオーバー画面。リトライ（直近のオートセーブから再開）または
/// タイトルへ戻るを選べる。
class GameOverScreen extends StatelessWidget {
  const GameOverScreen({super.key, required this.controller});

  final GameController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.heart_broken, color: Colors.redAccent, size: 72),
              const SizedBox(height: 16),
              const Text(
                'GAME OVER',
                style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: 220,
                child: ElevatedButton(
                  onPressed: () => controller.retryFromLastSave(),
                  child: const Text('リトライ'),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: 220,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                  onPressed: controller.returnToTitle,
                  child: const Text('タイトルへ戻る'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
