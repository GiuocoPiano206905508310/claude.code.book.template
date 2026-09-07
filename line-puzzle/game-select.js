/* ============================================================
   ゲーム選択画面
   ログイン（またはゲストプレイ）直後にここへ来る。ラインパズルか
   ブロックフィットパズルかを選び、それぞれのステージ選択画面へ進む。
   game.js と block-fit-puzzle.js のどちらより先に読み込まれる必要が
   ある（game.js の起動処理が window.openGameSelect を同期的に呼ぶため）。
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  window.openGameSelect = function () {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.remove('is-active');
    });
    $('screen-gameselect').classList.add('is-active');
  };

  $('choose-line-puzzle').addEventListener('click', function () {
    window.LinePuzzleGame.openSelect();
  });

  $('choose-block-fit').addEventListener('click', function () {
    window.BlockFitPuzzle.openSelect();
  });
})();
