/* ============================================================
   立体四目並べ — 画面まわり（DOM操作）
   3D描画やゲームロジックには触れず、ボタン・ダイアログ・フォームの
   見た目と入力だけを担当する。main.js から UI.init(handlers) で
   コールバックを渡して使う。

   window.ScoreFourUI として公開する。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    turnDot: $('turn-dot'), turnLabel: $('turn-label'), cpuThinking: $('cpu-thinking'),
    status: $('status'),
    btnUndo: $('btn-undo'), btnLog: $('btn-log'), btnSettings: $('btn-settings'), btnReset: $('btn-reset'),
    btnAccount: $('btn-account'),
    logWrap: $('log-wrap'), log: $('log'),

    endcard: $('endcard'), endHeadline: $('end-headline'), endSub: $('end-sub'),
    saveAsk: $('save-ask'), saveDone: $('save-done'),
    btnSaveYes: $('btn-save-yes'), btnSaveNo: $('btn-save-no'), btnAgain: $('btn-again'),

    confirmReset: $('confirm-reset'), btnResetCancel: $('btn-reset-cancel'), btnResetConfirm: $('btn-reset-confirm'),

    settings: $('settings'), modePills: $('mode-pills'), cpuOptions: $('cpu-options'),
    cpuLevel: $('cpu-level'), cpuLevelLabel: $('cpu-level-label'),
    undoEnabled: $('undo-enabled'), undoLimitRow: $('undo-limit-row'), undoLimit: $('undo-limit'),
    btnSettingsCancel: $('btn-settings-cancel'), btnSettingsApply: $('btn-settings-apply'),

    account: $('account'), meUsername: $('me-username'), meEmail: $('me-email'),
    btnSignout: $('btn-signout'), kifuList: $('kifu-list')
  };

  var handlers = {};
  var pendingFirst = 'human';
  var pendingMode = 'pvp';
  var currentAccountView = 'guest';
  var accountBackView = 'guest';

  function playerName(p) { return p === 1 ? '白' : '黒'; }

  /* ---------- 手番・トースト・棋譜ログ ---------- */

  function setTurn(player) {
    els.turnDot.className = 'dot ' + (player === 1 ? 'p1' : 'p2');
    els.turnLabel.innerHTML = '手番: <strong>' + playerName(player) + '</strong>';
  }

  function showCpuThinking(on) { els.cpuThinking.hidden = !on; }

  var statusTimer = null;
  function flashStatus(msg) {
    els.status.textContent = msg;
    els.status.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { els.status.classList.remove('show'); }, 1700);
  }

  function renderLog(moveHistory, notate) {
    if (!moveHistory.length) {
      els.log.innerHTML = '<div id="log-empty">まだ手はありません</div>';
      return;
    }
    els.log.innerHTML = moveHistory.map(function (m, i) {
      return '<div class="row p' + m.player + '">' +
        '<span class="mv">' + (i + 1) + '</span>' +
        '<span class="who">' + playerName(m.player) + (m.byCpu ? '(CPU)' : '') + '</span>' +
        '<span>' + notate(m.x, m.y, m.z) + '</span>' +
      '</div>';
    }).join('');
    els.log.scrollTop = els.log.scrollHeight;
  }

  function setBusy(busy) {
    els.btnReset.disabled = busy;
    els.btnSettings.disabled = busy;
  }
  function setUndoAvailable(available) { els.btnUndo.disabled = !available; }

  /* ---------- 対局終了ダイアログ ---------- */

  function showEnd(headline, sub) {
    els.endHeadline.textContent = headline;
    els.endSub.textContent = sub;
    els.saveAsk.hidden = false;
    els.saveDone.hidden = true;
    setTimeout(function () { els.endcard.classList.add('show'); }, 550);
  }
  function hideEnd() { els.endcard.classList.remove('show'); }
  function showSaveDone(msg) {
    els.saveAsk.hidden = true;
    els.saveDone.hidden = false;
    els.saveDone.textContent = msg;
  }

  /* ---------- リセット確認 ---------- */

  function openResetConfirm() { els.confirmReset.classList.add('show'); }
  function closeResetConfirm() { els.confirmReset.classList.remove('show'); }

  /* ---------- 設定ダイアログ ---------- */

  function paintModePills() {
    var btns = els.modePills.querySelectorAll('.pill');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.mode === pendingMode);
    els.cpuOptions.hidden = pendingMode !== 'cpu';
  }
  function paintFirstPills() {
    var btns = els.settings.querySelectorAll('[data-first]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.first === pendingFirst);
  }
  function paintUndoRow() {
    els.undoLimitRow.classList.toggle('disabled', !els.undoEnabled.checked);
  }

  function openSettings(current) {
    pendingMode = current.mode;
    pendingFirst = current.humanFirst ? 'human' : 'cpu';
    els.cpuLevel.value = current.cpuLevel;
    els.cpuLevelLabel.textContent = 'レベル ' + current.cpuLevel;
    els.undoEnabled.checked = current.undoEnabled;
    els.undoLimit.value = current.undoLimit == null ? 'unlimited' : String(current.undoLimit);
    paintModePills(); paintFirstPills(); paintUndoRow();
    els.settings.classList.add('show');
  }
  function closeSettings() { els.settings.classList.remove('show'); }

  els.modePills.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode]');
    if (!btn) return;
    pendingMode = btn.dataset.mode;
    paintModePills();
  });
  els.settings.querySelectorAll('[data-first]').forEach(function (btn) {
    btn.addEventListener('click', function () { pendingFirst = btn.dataset.first; paintFirstPills(); });
  });
  els.cpuLevel.addEventListener('input', function () {
    els.cpuLevelLabel.textContent = 'レベル ' + els.cpuLevel.value;
  });
  els.undoEnabled.addEventListener('change', paintUndoRow);

  els.btnSettingsCancel.addEventListener('click', function () { closeSettings(); });
  els.btnSettingsApply.addEventListener('click', function () {
    var limitVal = els.undoLimit.value;
    var settings = {
      mode: pendingMode,
      cpuLevel: parseInt(els.cpuLevel.value, 10),
      humanFirst: pendingFirst === 'human',
      undoEnabled: els.undoEnabled.checked,
      undoLimit: limitVal === 'unlimited' ? null : parseInt(limitVal, 10)
    };
    closeSettings();
    if (handlers.onSettingsApply) handlers.onSettingsApply(settings);
  });

  /* ---------- アカウント ダイアログ ---------- */

  function showView(view) {
    if (view === 'kifu') accountBackView = currentAccountView;
    currentAccountView = view;
    els.account.querySelectorAll('.avview').forEach(function (el) {
      el.hidden = el.dataset.view !== view;
    });
  }

  function setMsg(view, text, ok) {
    var el = els.account.querySelector('[data-msg="' + view + '"]');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
  }

  function openAccount(signedInUser, forceView) {
    els.account.querySelectorAll('.msg').forEach(function (m) { m.textContent = ''; });
    if (forceView) {
      showView(forceView);
    } else if (signedInUser) {
      els.meUsername.textContent = signedInUser.username || '';
      els.meEmail.textContent = signedInUser.email || '';
      showView('me');
    } else {
      showView('guest');
    }
    els.account.classList.add('show');
  }
  function closeAccount() { els.account.classList.remove('show'); }
  function updateMe(user) {
    if (!user) return;
    els.meUsername.textContent = user.username || '';
    els.meEmail.textContent = user.email || '';
  }

  function setAccountButtonLabel(user) {
    els.btnAccount.textContent = user ? (user.username || 'アカウント') : 'ログイン';
  }

  els.btnAccount.addEventListener('click', function () {
    if (handlers.onAccountButton) handlers.onAccountButton();
  });

  els.account.addEventListener('click', function (e) {
    var goto = e.target.closest('[data-goto]');
    if (!goto) return;
    var target = goto.dataset.goto === 'back' ? accountBackView : goto.dataset.goto;
    showView(target);
    if (target === 'kifu' && handlers.onKifuListOpen) handlers.onKifuListOpen();
  });

  els.account.querySelector('form[data-view="login"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onSignIn) handlers.onSignIn(f.email.value, f.password.value);
  });
  els.account.querySelector('form[data-view="signup"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onSignUp) handlers.onSignUp(f.username.value, f.email.value, f.password.value);
  });
  els.account.querySelector('form[data-view="forgot"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onForgotPassword) handlers.onForgotPassword(f.email.value);
  });
  els.account.querySelector('form[data-view="recovery"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onSetRecoveryPassword) handlers.onSetRecoveryPassword(f.password.value);
  });
  els.account.querySelector('form[data-action="change-name"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onChangeName) handlers.onChangeName(f.username.value);
  });
  els.account.querySelector('form[data-action="change-email"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onChangeEmail) handlers.onChangeEmail(f.email.value);
  });
  els.account.querySelector('form[data-action="change-password"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onChangePassword) handlers.onChangePassword(f.current.value, f.next.value);
  });
  els.btnSignout.addEventListener('click', function () { if (handlers.onSignOut) handlers.onSignOut(); });

  function renderKifuList(items) {
    if (!items || !items.length) {
      els.kifuList.innerHTML = '<p class="sub">まだ保存された対局はありません。</p>';
      return;
    }
    els.kifuList.innerHTML = items.slice().reverse().map(function (k) {
      var d = new Date(k.date);
      var dateStr = isNaN(d) ? k.date : (d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
      var modeStr = k.mode === 'cpu' ? 'CPU戦 (Lv.' + k.cpuLevel + ')' : '対人戦';
      var resultStr = k.result === 'draw' ? '引き分け' : (playerName(k.result) + 'の勝ち');
      return '<div class="kifu-item"><span>' + modeStr + ' ・ ' + k.moveCount + '手<br><span class="result">' + resultStr + '</span></span><span class="date">' + dateStr + '</span></div>';
    }).join('');
  }

  /* ---------- ボタン基本配線 ---------- */

  els.btnUndo.addEventListener('click', function () { if (handlers.onUndo) handlers.onUndo(); });
  els.btnLog.addEventListener('click', function () { els.logWrap.classList.toggle('open'); });
  els.btnReset.addEventListener('click', function () { if (handlers.onResetButton) handlers.onResetButton(); });
  els.btnSettings.addEventListener('click', function () { if (handlers.onSettingsButton) handlers.onSettingsButton(); });
  els.btnResetCancel.addEventListener('click', closeResetConfirm);
  els.btnResetConfirm.addEventListener('click', function () {
    closeResetConfirm();
    if (handlers.onResetConfirmed) handlers.onResetConfirmed();
  });
  els.btnSaveNo.addEventListener('click', function () {
    showSaveDone('保存しませんでした。');
    if (handlers.onSaveKifu) handlers.onSaveKifu(false);
  });
  els.btnSaveYes.addEventListener('click', function () {
    if (handlers.onSaveKifu) handlers.onSaveKifu(true);
  });
  els.btnAgain.addEventListener('click', function () {
    hideEnd();
    if (handlers.onPlayAgain) handlers.onPlayAgain();
  });

  window.ScoreFourUI = {
    init: function (h) { handlers = h || {}; },
    setTurn: setTurn,
    showCpuThinking: showCpuThinking,
    flashStatus: flashStatus,
    renderLog: renderLog,
    setBusy: setBusy,
    setUndoAvailable: setUndoAvailable,
    showEnd: showEnd,
    hideEnd: hideEnd,
    showSaveDone: showSaveDone,
    openResetConfirm: openResetConfirm,
    closeResetConfirm: closeResetConfirm,
    openSettings: openSettings,
    closeSettings: closeSettings,
    openAccount: openAccount,
    closeAccount: closeAccount,
    updateMe: updateMe,
    setAccountButtonLabel: setAccountButtonLabel,
    setMsg: setMsg,
    showView: showView,
    renderKifuList: renderKifuList
  };
})();
