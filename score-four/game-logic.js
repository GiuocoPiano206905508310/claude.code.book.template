/* ============================================================
   立体四目並べ — 盤面ロジック
   board / 手番 / 勝利判定など、画面や3D描画に依存しない部分。
   Web Worker からも importScripts() で読み込むので、
   ブラウザのメインスレッドと Worker の両方で動く書き方にする
   （self はどちらの文脈でもグローバルオブジェクトを指す）。
   ============================================================ */
(function (self) {
  'use strict';

  var N = 4;

  function createBoard() {
    return Array.from({ length: N }, function () {
      return Array.from({ length: N }, function () { return Array(N).fill(0); });
    });
  }

  function cloneBoard(board) {
    return board.map(function (plane) {
      return plane.map(function (col) { return col.slice(); });
    });
  }

  function getDropZ(board, x, y) {
    for (var z = 0; z < N; z++) if (board[x][y][z] === 0) return z;
    return -1;
  }

  function legalColumns(board) {
    var cols = [];
    for (var x = 0; x < N; x++) {
      for (var y = 0; y < N; y++) {
        if (getDropZ(board, x, y) !== -1) cols.push([x, y]);
      }
    }
    return cols;
  }

  function isBoardFull(board) {
    return legalColumns(board).length === 0;
  }

  // 全76本の必勝ライン。起動時に一度だけ計算してキャッシュする。
  function generateAllLines() {
    var directions = [];
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          var first = [dx, dy, dz].find(function (v) { return v !== 0; });
          if (first < 0) continue;
          directions.push([dx, dy, dz]);
        }
      }
    }
    var lines = [];
    for (var x = 0; x < N; x++) {
      for (var y = 0; y < N; y++) {
        for (var z = 0; z < N; z++) {
          for (var i = 0; i < directions.length; i++) {
            var d = directions[i];
            var cells = [];
            var valid = true;
            for (var k = 0; k < N; k++) {
              var nx = x + d[0] * k, ny = y + d[1] * k, nz = z + d[2] * k;
              if (nx < 0 || nx > 3 || ny < 0 || ny > 3 || nz < 0 || nz > 3) { valid = false; break; }
              cells.push([nx, ny, nz]);
            }
            if (valid) lines.push(cells);
          }
        }
      }
    }
    return lines;
  }

  var ALL_LINES = generateAllLines();

  function findWinLine(board, player) {
    for (var i = 0; i < ALL_LINES.length; i++) {
      var line = ALL_LINES[i];
      var ok = true;
      for (var k = 0; k < 4; k++) {
        var c = line[k];
        if (board[c[0]][c[1]][c[2]] !== player) { ok = false; break; }
      }
      if (ok) return line;
    }
    return null;
  }

  function checkWin(board, player) {
    return !!findWinLine(board, player);
  }

  var COL_LETTERS = ['a', 'b', 'c', 'd'];
  function notate(x, y, z) { return COL_LETTERS[x] + (y + 1) + '-' + (z + 1); }

  self.ScoreFourGame = {
    N: N,
    ALL_LINES: ALL_LINES,
    createBoard: createBoard,
    cloneBoard: cloneBoard,
    getDropZ: getDropZ,
    legalColumns: legalColumns,
    isBoardFull: isBoardFull,
    findWinLine: findWinLine,
    checkWin: checkWin,
    notate: notate
  };
})(typeof self !== 'undefined' ? self : this);
