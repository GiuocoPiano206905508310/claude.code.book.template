/* ============================================================
   立体4目並べ — 盤面ロジック
   board / 手番 / 勝利判定など、画面や3D描画に依存しない部分。
   Web Worker からも importScripts() で読み込むので、
   ブラウザのメインスレッドと Worker の両方で動く書き方にする
   （self はどちらの文脈でもグローバルオブジェクトを指す）。

   盤のサイズ(N)は3(立体3目並べ)・4(立体4目並べ)・5(立体5目並べ)を
   切り替えられるようにしてあり、盤を一直線に埋めたら勝ち、という
   ルールはNに関わらず共通。Nは各関数にboardそのものから読み取るため
   (board.length)、盤面データさえ渡せばWorker側でも意識せず動く。
   ============================================================ */
(function (self) {
  'use strict';

  function createBoard(n) {
    return Array.from({ length: n }, function () {
      return Array.from({ length: n }, function () { return Array(n).fill(0); });
    });
  }

  function cloneBoard(board) {
    return board.map(function (plane) {
      return plane.map(function (col) { return col.slice(); });
    });
  }

  function getDropZ(board, x, y) {
    var col = board[x][y];
    for (var z = 0; z < col.length; z++) if (col[z] === 0) return z;
    return -1;
  }

  function legalColumns(board) {
    var n = board.length;
    var cols = [];
    for (var x = 0; x < n; x++) {
      for (var y = 0; y < n; y++) {
        if (getDropZ(board, x, y) !== -1) cols.push([x, y]);
      }
    }
    return cols;
  }

  function isBoardFull(board) {
    return legalColumns(board).length === 0;
  }

  // 盤全体を貫く必勝ライン。Nごとに一度だけ計算してキャッシュする。
  var linesCache = {};
  function getLines(n) {
    if (linesCache[n]) return linesCache[n];
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
    for (var x = 0; x < n; x++) {
      for (var y = 0; y < n; y++) {
        for (var z = 0; z < n; z++) {
          for (var i = 0; i < directions.length; i++) {
            var d = directions[i];
            var cells = [];
            var valid = true;
            for (var k = 0; k < n; k++) {
              var nx = x + d[0] * k, ny = y + d[1] * k, nz = z + d[2] * k;
              if (nx < 0 || nx >= n || ny < 0 || ny >= n || nz < 0 || nz >= n) { valid = false; break; }
              cells.push([nx, ny, nz]);
            }
            if (valid) lines.push(cells);
          }
        }
      }
    }
    linesCache[n] = lines;
    return lines;
  }

  function findWinLine(board, player) {
    var n = board.length;
    var lines = getLines(n);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var ok = true;
      for (var k = 0; k < n; k++) {
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

  var COL_LETTERS = ['a', 'b', 'c', 'd', 'e'];
  function notate(x, y, z) { return COL_LETTERS[x] + (y + 1) + '-' + (z + 1); }

  self.ScoreFourGame = {
    createBoard: createBoard,
    cloneBoard: cloneBoard,
    getDropZ: getDropZ,
    legalColumns: legalColumns,
    isBoardFull: isBoardFull,
    getLines: getLines,
    findWinLine: findWinLine,
    checkWin: checkWin,
    notate: notate
  };
})(typeof self !== 'undefined' ? self : this);
