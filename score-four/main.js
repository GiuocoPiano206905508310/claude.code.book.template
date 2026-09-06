/* ============================================================
   立体四目並べ — 進行管理
   盤面・手番・設定・CPU思考・棋譜保存・アカウント連携をまとめる。
   3D描画は Render、画面部品は UI、盤面ロジックは Game、
   クラウド保存は Cloud に任せ、ここでは「つなぐ」ことに専念する。
   ============================================================ */
(function () {
  'use strict';

  function showBootError(message, detail) {
    document.getElementById('boot-error-msg').textContent = message;
    var detailEl = document.getElementById('boot-error-detail');
    if (detail) { detailEl.textContent = detail; detailEl.hidden = false; }
    document.getElementById('boot-error').style.display = 'flex';
  }

  if (typeof THREE === 'undefined') {
    showBootError('3D描画ライブラリの読み込みに失敗しました。通信状態を確認し、再読み込みしてください。');
    return;
  }

  try {
  var Game = window.ScoreFourGame;
  var Render = window.ScoreFourRender;
  var UI = window.ScoreFourUI;
  var Cloud = window.ScoreFourCloud;

  var SETTINGS_KEY = 'scoreFour.settings.v1';
  var GUEST_KIFU_KEY = 'scoreFour.kifu.guest.v1';
  var DEFAULT_SETTINGS = { mode: 'pvp', cpuLevel: 5, humanFirst: true, undoEnabled: true, undoLimit: 3, background: 'dark' };
  var MAX_KIFU = 30;

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      var s = raw ? JSON.parse(raw) : null;
      if (s && s.mode) return Object.assign({}, DEFAULT_SETTINGS, s);
    } catch (e) { /* 既定値を使う */ }
    return Object.assign({}, DEFAULT_SETTINGS);
  }
  function saveSettingsLocal(s) {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 保存できなくても続行 */ }
  }

  function loadGuestKifu() {
    try {
      var raw = window.localStorage.getItem(GUEST_KIFU_KEY);
      var a = raw ? JSON.parse(raw) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveGuestKifu(list) {
    try { window.localStorage.setItem(GUEST_KIFU_KEY, JSON.stringify(list.slice(-MAX_KIFU))); } catch (e) { /* 保存できなくても続行 */ }
  }

  var settings = loadSettings();
  var cloudProgress = null; // ログイン中: { settings, kifu }

  var board = Game.createBoard();
  var currentPlayer = 1;
  var moveHistory = [];
  var gameOver = false;
  var animating = false;
  var cpuThinking = false;
  var undoUsedCount = 0;
  var pendingKifu = null;
  var cpuReqId = 0;
  var worker = null;
  try { worker = new Worker('ai-worker.js?v=7'); } catch (e) { worker = null; }
  if (worker) {
    worker.onmessage = function (e) {
      var data = e.data || {};
      if (data.requestId !== cpuReqId) return; // 古い応答は無視（リセット直後など）
      var move = data.move;
      cpuThinking = false;
      UI.showCpuThinking(false);
      if (!move) { finishGuard(); return; }
      setTimeout(function () { attemptMove(move.x, move.y, true); }, 220);
    };
  }

  function cpuPlayerNumber() { return settings.humanFirst ? 2 : 1; }
  function isCpuTurn() { return settings.mode === 'cpu' && !!worker && currentPlayer === cpuPlayerNumber(); }

  function finishGuard() { UI.setBusy(false); Render.setInteractionEnabled(!gameOver); }

  /* ---------- 対局開始 ---------- */

  function startGame() {
    board = Game.createBoard();
    currentPlayer = 1;
    moveHistory = [];
    gameOver = false;
    animating = false;
    cpuThinking = false;
    undoUsedCount = 0;
    cpuReqId++; // 進行中だったCPU思考の応答を無効化
    pendingKifu = null;

    Render.clearBoard();
    Render.setBoardRef(board);
    Render.setBackground(settings.background);
    Render.setInteractionEnabled(true);
    UI.setTurn(currentPlayer);
    UI.renderLog(moveHistory, Game.notate);
    UI.setUndoAvailable(false);
    UI.setBusy(false);
    UI.showCpuThinking(false);
    UI.hideEnd();

    if (isCpuTurn()) triggerCpuMove();
  }

  /* ---------- 一手指す ---------- */

  function attemptMove(x, y, byCpu) {
    if (gameOver || animating) return;
    var z = Game.getDropZ(board, x, y);
    if (z === -1) { UI.flashStatus('その棒はいっぱいです'); return; }

    animating = true;
    Render.setInteractionEnabled(false);
    UI.setBusy(true);

    board[x][y][z] = currentPlayer;
    var mover = currentPlayer;
    moveHistory.push({ x: x, y: y, z: z, player: mover, byCpu: !!byCpu });
    UI.renderLog(moveHistory, Game.notate);

    Render.placeBall(x, y, z, mover, function () {
      animating = false;
      var winLine = Game.findWinLine(board, mover);
      if (winLine) {
        gameOver = true;
        Render.highlightWin(winLine);
        openEnd(mover, x, y, z);
      } else if (Game.isBoardFull(board)) {
        gameOver = true;
        openEnd(null, x, y, z);
      } else {
        currentPlayer = mover === 1 ? 2 : 1;
        UI.setTurn(currentPlayer);
        Render.setInteractionEnabled(true);
        UI.setBusy(false);
        updateUndoButton();
        if (isCpuTurn()) triggerCpuMove();
      }
    });
  }

  function triggerCpuMove() {
    if (!worker) return;
    cpuThinking = true;
    UI.showCpuThinking(true);
    Render.setInteractionEnabled(false);
    UI.setBusy(true);
    UI.setUndoAvailable(false);
    var me = currentPlayer, opp = me === 1 ? 2 : 1;
    worker.postMessage({ board: Game.cloneBoard(board), me: me, opp: opp, level: settings.cpuLevel, requestId: ++cpuReqId });
  }

  /* ---------- 待った（Undo） ---------- */

  function canUndo() {
    if (!settings.undoEnabled || animating || cpuThinking || gameOver) return false;
    if (!moveHistory.length) return false;
    if (settings.undoLimit != null && undoUsedCount >= settings.undoLimit) return false;
    return true;
  }
  function updateUndoButton() { UI.setUndoAvailable(canUndo()); }

  function performUndo() {
    if (!canUndo()) return;
    var popCount = 1;
    if (settings.mode === 'cpu' && moveHistory.length >= 2 && moveHistory[moveHistory.length - 1].byCpu) popCount = 2;
    for (var i = 0; i < popCount && moveHistory.length; i++) {
      var last = moveHistory.pop();
      board[last.x][last.y][last.z] = 0;
      Render.removeBall(last.x, last.y, last.z);
      currentPlayer = last.player;
    }
    undoUsedCount++;
    UI.setTurn(currentPlayer);
    UI.renderLog(moveHistory, Game.notate);
    updateUndoButton();
    var remain = settings.undoLimit == null ? '' : '（残り' + Math.max(0, settings.undoLimit - undoUsedCount) + '回）';
    UI.flashStatus('待った ' + remain);
  }

  /* ---------- 対局終了・棋譜保存 ---------- */

  function openEnd(winner, x, y, z) {
    UI.setBusy(false);
    Render.setInteractionEnabled(false);
    var headline = winner ? (winner === 1 ? '白' : '黒') + 'の勝ち' : '引き分け';
    var sub = winner ? (Game.notate(x, y, z) + ' で四目が揃いました') : '64マスすべてが埋まりました';
    UI.showEnd(headline, sub);
    pendingKifu = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      date: new Date().toISOString(),
      mode: settings.mode,
      cpuLevel: settings.mode === 'cpu' ? settings.cpuLevel : undefined,
      result: winner || 'draw',
      moveCount: moveHistory.length,
      moves: moveHistory.map(function (m) { return { x: m.x, y: m.y, z: m.z, player: m.player }; })
    };
  }

  function handleSaveKifu(save) {
    if (!save || !pendingKifu) return;
    if (Cloud.signedIn()) {
      var progress = cloudProgress || { settings: settings, kifu: [] };
      progress.kifu = (progress.kifu || []).concat([pendingKifu]).slice(-MAX_KIFU);
      progress.settings = settings;
      Cloud.saveProgress(progress).then(function () {
        cloudProgress = progress;
        UI.showSaveDone('棋譜を保存しました。');
      }, function (err) {
        UI.showSaveDone('保存に失敗しました：' + err.message);
      });
    } else {
      var list = loadGuestKifu().concat([pendingKifu]);
      saveGuestKifu(list);
      UI.showSaveDone('この端末に保存しました（ログインするとどの端末からも見られます）。');
    }
  }

  /* ---------- 設定 ---------- */

  function applyBackground(bg) {
    settings = Object.assign({}, settings, { background: bg });
    Render.setBackground(bg);
    saveSettingsLocal(settings);
    if (Cloud.signedIn()) {
      var progress = cloudProgress || { settings: settings, kifu: [] };
      progress.settings = settings;
      cloudProgress = progress;
      Cloud.saveProgress(progress).catch(function () { /* 次の保存機会に任せる */ });
    }
  }

  function applySettings(newSettings) {
    settings = newSettings;
    saveSettingsLocal(settings);
    if (Cloud.signedIn()) {
      var progress = cloudProgress || { settings: settings, kifu: [] };
      progress.settings = settings;
      cloudProgress = progress;
      Cloud.saveProgress(progress).catch(function () { /* 次の保存機会に任せる */ });
    }
    startGame();
  }

  /* ---------- アカウント ---------- */

  function afterSignedIn(user) {
    UI.setAccountButtonLabel(user);
    Cloud.fetchProgress().then(function (progress) {
      if (progress) {
        cloudProgress = progress;
        if (progress.settings) {
          settings = Object.assign({}, DEFAULT_SETTINGS, progress.settings);
          saveSettingsLocal(settings);
        }
      } else {
        // 初めてのログイン: この端末の設定と棋譜をアカウントへ引き継ぐ
        cloudProgress = { settings: settings, kifu: loadGuestKifu() };
        Cloud.saveProgress(cloudProgress).catch(function () { /* 次の保存機会に任せる */ });
      }
    }).catch(function () { /* 取得に失敗してもローカルの設定で続行 */ });
  }

  UI.init({
    onUndo: performUndo,
    onResetButton: function () { UI.openResetConfirm(); },
    onResetConfirmed: startGame,
    onSettingsButton: function () { UI.openSettings(settings); },
    onSettingsApply: applySettings,
    onBackgroundChange: applyBackground,
    onSaveKifu: handleSaveKifu,
    onPlayAgain: startGame,

    onAccountButton: function () { UI.openAccount(Cloud.signedIn() ? Cloud.user() : null); },
    onSignIn: function (email, password) {
      Cloud.signIn(email, password).then(function (s) {
        afterSignedIn(s.user);
        UI.openAccount(s.user);
        UI.flashStatus(s.user.username + ' でログインしました');
      }, function (err) { UI.setMsg('login', err.message, false); });
    },
    onSignUp: function (username, email, password) {
      Cloud.signUp(username, email, password).then(function (res) {
        if (res.needsConfirm) {
          UI.setMsg('signup', '確認メールを送りました。メールのリンクを開いてから、ログインしてください。', true);
        } else {
          afterSignedIn(res.session.user);
          UI.openAccount(res.session.user);
          UI.flashStatus('登録しました');
        }
      }, function (err) { UI.setMsg('signup', err.message, false); });
    },
    onForgotPassword: function (email) {
      Cloud.sendReset(email).then(function () {
        UI.setMsg('forgot', 'パスワード再設定のメールを送りました。', true);
      }, function (err) { UI.setMsg('forgot', err.message, false); });
    },
    onSignOut: function () {
      Cloud.signOut().then(function () {
        cloudProgress = null;
        UI.setAccountButtonLabel(null);
        UI.closeAccount();
        UI.flashStatus('ログアウトしました');
      });
    },
    onChangeName: function (username) {
      Cloud.changeName(username).then(function () {
        UI.updateMe(Cloud.user());
        UI.setAccountButtonLabel(Cloud.user());
        UI.setMsg('change-name', 'ユーザー名を変更しました。', true);
      }, function (err) { UI.setMsg('change-name', err.message, false); });
    },
    onChangeEmail: function (email) {
      Cloud.changeEmail(email).then(function () {
        UI.setMsg('change-email', '新しいアドレスに確認メールを送りました。開くまでは今のアドレスのままです。', true);
      }, function (err) { UI.setMsg('change-email', err.message, false); });
    },
    onChangePassword: function (current, next) {
      Cloud.changePassword(current, next).then(function () {
        UI.setMsg('change-password', 'パスワードを変更しました。', true);
      }, function (err) { UI.setMsg('change-password', err.message, false); });
    },
    onSetRecoveryPassword: function (password) {
      Cloud.setPassword(password).then(function () {
        afterSignedIn(Cloud.user());
        UI.setMsg('recovery', 'パスワードを設定しました。', true);
        setTimeout(function () { UI.openAccount(Cloud.user()); }, 900);
      }, function (err) { UI.setMsg('recovery', err.message, false); });
    },
    onKifuListOpen: function () {
      if (Cloud.signedIn()) {
        UI.renderKifuList(cloudProgress && cloudProgress.kifu);
      } else {
        UI.renderKifuList(loadGuestKifu());
      }
    }
  });

  /* ---------- 起動 ---------- */

  var stage = document.getElementById('stage');
  Render.init(stage);
  Render.onColumnTap = function (x, y) {
    if (gameOver || animating || cpuThinking) return;
    if (isCpuTurn()) return;
    attemptMove(x, y, false);
  };
  UI.setAccountButtonLabel(Cloud.signedIn() ? Cloud.user() : null);
  startGame();

  // メール確認・パスワード再設定リンクから戻ってきた場合
  var redirect = Cloud.readAuthRedirect();
  if (redirect) {
    if (redirect.error) {
      UI.flashStatus(redirect.error);
    } else if (redirect.type === 'recovery') {
      UI.openAccount(null, 'recovery');
      if (redirect.pending) redirect.pending.catch(function () { /* パスワード設定自体は続行できる */ });
    } else if (redirect.pending) {
      redirect.pending.then(function (user) {
        if (user) { afterSignedIn(user); UI.flashStatus('メールの確認ができました。'); }
      }).catch(function () { /* 反映できなくても操作は続行できる */ });
    }
  } else if (Cloud.signedIn()) {
    afterSignedIn(Cloud.user());
  }
  } catch (err) {
    showBootError('画面の初期化に失敗しました。再読み込みしてください。', String(err && err.message || err));
  }
})();
