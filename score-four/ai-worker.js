/* ============================================================
   立体四目並べ — CPU思考ルーチン（Web Worker）
   メインスレッドを止めないよう、別スレッドで探索する。

   強さは 1〜10 の10段階。数字が大きいほど深く読み、
   ぶれ（ランダム性）が減る。どのレベルでも「今すぐ勝てる手」は
   必ず選ぶ（見え見えの一手を逃す弱さは表現しない）。

   探索は反復深化 + アルファベータ法。レベルごとに
   「目標の深さ」と「持ち時間」の両方に上限を設け、
   持ち時間を超えたら探索中でもその時点の最善手で打ち切る。
   ============================================================ */
importScripts('game-logic.js?v=2');

var Game = self.ScoreFourGame;
var N = Game.N;
var ALL_LINES = Game.ALL_LINES;

// レベル → { 目標の最大深さ, 持ち時間(ms), 最善手を外してランダムに打つ確率 }
var LEVELS = {
  1: { depth: 1, time: 60, randomness: 0.55 },
  2: { depth: 1, time: 80, randomness: 0.4 },
  3: { depth: 2, time: 120, randomness: 0.28 },
  4: { depth: 2, time: 180, randomness: 0.18 },
  5: { depth: 3, time: 260, randomness: 0.1 },
  6: { depth: 3, time: 340, randomness: 0.04 },
  7: { depth: 4, time: 450, randomness: 0 },
  8: { depth: 5, time: 600, randomness: 0 },
  9: { depth: 5, time: 780, randomness: 0 },
  10: { depth: 6, time: 950, randomness: 0 }
};

// 各ラインの「自分だけ／相手だけ」の並び具合を点数化する、定番の評価関数
var LINE_SCORE = [0, 1, 12, 130, 100000];

function evaluate(board, me, opp) {
  var score = 0;
  for (var i = 0; i < ALL_LINES.length; i++) {
    var line = ALL_LINES[i];
    var mine = 0, theirs = 0;
    for (var k = 0; k < 4; k++) {
      var c = line[k];
      var v = board[c[0]][c[1]][c[2]];
      if (v === me) mine++;
      else if (v === opp) theirs++;
    }
    if (mine > 0 && theirs > 0) continue; // 両者混在なら、もう勝敗に絡まないライン
    if (mine > 0) score += LINE_SCORE[mine];
    else if (theirs > 0) score -= LINE_SCORE[theirs];
  }
  return score;
}

// 盤の中央に近い柱ほど有利になりやすいので、探索順の先頭に置いて
// アルファベータの枝刈りを効きやすくする
var CENTER_ORDER = (function () {
  var cols = [];
  for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) cols.push([x, y]);
  var c = (N - 1) / 2;
  cols.sort(function (a, b) {
    var da = Math.abs(a[0] - c) + Math.abs(a[1] - c);
    var db = Math.abs(b[0] - c) + Math.abs(b[1] - c);
    return da - db;
  });
  return cols;
})();

function legalColumnsOrdered(board) {
  var cols = [];
  for (var i = 0; i < CENTER_ORDER.length; i++) {
    var x = CENTER_ORDER[i][0], y = CENTER_ORDER[i][1];
    if (Game.getDropZ(board, x, y) !== -1) cols.push([x, y]);
  }
  return cols;
}

var deadline = 0;
function timeUp() { return Date.now() >= deadline; }

function minimax(board, depth, alpha, beta, maximizing, me, opp) {
  var win = Game.findWinLine(board, me);
  if (win) return 100000 + depth; // 早く勝つほど高評価
  var lose = Game.findWinLine(board, opp);
  if (lose) return -100000 - depth;
  var cols = legalColumnsOrdered(board);
  if (depth === 0 || cols.length === 0 || timeUp()) return evaluate(board, me, opp);

  if (maximizing) {
    var best = -Infinity;
    for (var i = 0; i < cols.length; i++) {
      var x = cols[i][0], y = cols[i][1];
      var z = Game.getDropZ(board, x, y);
      board[x][y][z] = me;
      var val = minimax(board, depth - 1, alpha, beta, false, me, opp);
      board[x][y][z] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta || timeUp()) break;
    }
    return best;
  } else {
    var worst = Infinity;
    for (var j = 0; j < cols.length; j++) {
      var xx = cols[j][0], yy = cols[j][1];
      var zz = Game.getDropZ(board, xx, yy);
      board[xx][yy][zz] = opp;
      var v2 = minimax(board, depth - 1, alpha, beta, true, me, opp);
      board[xx][yy][zz] = 0;
      if (v2 < worst) worst = v2;
      if (worst < beta) beta = worst;
      if (alpha >= beta || timeUp()) break;
    }
    return worst;
  }
}

function bestMove(board, me, opp, level) {
  var cfg = LEVELS[level] || LEVELS[5];
  var cols = legalColumnsOrdered(board);
  if (!cols.length) return null;

  // 見え見えの一手（今すぐ勝てる）はレベルに関係なく必ず選ぶ
  for (var i = 0; i < cols.length; i++) {
    var x = cols[i][0], y = cols[i][1];
    var z = Game.getDropZ(board, x, y);
    board[x][y][z] = me;
    var wins = Game.checkWin(board, me);
    board[x][y][z] = 0;
    if (wins) return { x: x, y: y };
  }

  deadline = Date.now() + cfg.time;
  var scored = cols.map(function (c) { return { x: c[0], y: c[1], score: -Infinity }; });

  // 反復深化: 浅い深さから順に読み、時間切れならその手前の結果を使う
  for (var d = 1; d <= cfg.depth; d++) {
    if (timeUp()) break;
    var alpha = -Infinity, beta = Infinity;
    var roundScores = [];
    var abortedRound = false;
    for (var k = 0; k < cols.length; k++) {
      var cx = cols[k][0], cy = cols[k][1];
      var cz = Game.getDropZ(board, cx, cy);
      board[cx][cy][cz] = me;
      var val = minimax(board, d - 1, alpha, beta, false, me, opp);
      board[cx][cy][cz] = 0;
      roundScores.push({ x: cx, y: cy, score: val });
      if (val > alpha) alpha = val;
      if (timeUp()) { abortedRound = true; break; }
    }
    if (!abortedRound) scored = roundScores;
    else break;
  }

  scored.sort(function (a, b) { return b.score - a.score; });

  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    // ランダム性を出すときも、あからさまな悪手は避けて上位からゆるく選ぶ
    var pool = scored.slice(0, Math.min(scored.length, 4));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return scored[0];
}

self.onmessage = function (e) {
  var msg = e.data || {};
  var move = bestMove(msg.board, msg.me, msg.opp, msg.level);
  self.postMessage({ requestId: msg.requestId, move: move });
};
