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
    btnHelp: $('btn-help'), btnAccount: $('btn-account'),
    logWrap: $('log-wrap'), log: $('log'),

    tutorial: $('tutorial'), tutSkip: $('tut-skip'), tutEyebrow: $('tut-eyebrow'), tutHeadline: $('tut-headline'),
    tutStage: $('tut-stage'), tutBody: $('tut-body'), tutDots: $('tut-dots'), tutPrev: $('tut-prev'), tutNext: $('tut-next'),

    endcard: $('endcard'), endHeadline: $('end-headline'), endSub: $('end-sub'),
    saveAsk: $('save-ask'), saveDone: $('save-done'),
    btnSaveYes: $('btn-save-yes'), btnSaveNo: $('btn-save-no'), btnAgain: $('btn-again'),

    confirmReset: $('confirm-reset'), btnResetCancel: $('btn-reset-cancel'), btnResetConfirm: $('btn-reset-confirm'),

    settings: $('settings'), modePills: $('mode-pills'), cpuOptions: $('cpu-options'),
    cpuLevel: $('cpu-level'), cpuLevelLabel: $('cpu-level-label'),
    undoEnabled: $('undo-enabled'), undoLimitRow: $('undo-limit-row'), undoLimit: $('undo-limit'),
    bgPills: $('background-pills'),
    btnSettingsCancel: $('btn-settings-cancel'), btnSettingsApply: $('btn-settings-apply'),

    account: $('account'), authTabs: $('auth-tabs'), meUsername: $('me-username'), meEmail: $('me-email'),
    btnSignout: $('btn-signout'), kifuList: $('kifu-list')
  };

  var handlers = {};
  var pendingFirst = 'human';
  var pendingMode = 'pvp';
  var pendingBackground = 'dark';
  var currentAccountView = 'auth';
  var accountBackView = 'auth';

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
  function paintBgPills() {
    var btns = els.bgPills.querySelectorAll('.pill');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.bg === pendingBackground);
  }

  function openSettings(current) {
    pendingMode = current.mode;
    pendingFirst = current.humanFirst ? 'human' : 'cpu';
    pendingBackground = current.background || 'dark';
    els.cpuLevel.value = current.cpuLevel;
    els.cpuLevelLabel.textContent = 'レベル ' + current.cpuLevel;
    els.undoEnabled.checked = current.undoEnabled;
    els.undoLimit.value = current.undoLimit == null ? 'unlimited' : String(current.undoLimit);
    paintModePills(); paintFirstPills(); paintUndoRow(); paintBgPills();
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
  els.bgPills.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-bg]');
    if (!btn) return;
    pendingBackground = btn.dataset.bg;
    paintBgPills();
    if (handlers.onBackgroundChange) handlers.onBackgroundChange(pendingBackground);
  });

  els.btnSettingsCancel.addEventListener('click', function () { closeSettings(); });
  els.btnSettingsApply.addEventListener('click', function () {
    var limitVal = els.undoLimit.value;
    var settings = {
      mode: pendingMode,
      cpuLevel: parseInt(els.cpuLevel.value, 10),
      humanFirst: pendingFirst === 'human',
      undoEnabled: els.undoEnabled.checked,
      undoLimit: limitVal === 'unlimited' ? null : parseInt(limitVal, 10),
      background: pendingBackground
    };
    closeSettings();
    if (handlers.onSettingsApply) handlers.onSettingsApply(settings);
  });

  /* ---------- アカウント ダイアログ ---------- */

  function showView(view) {
    accountBackView = currentAccountView;
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

  function showAuthTab(tab) {
    els.authTabs.querySelectorAll('.pill').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
      btn.setAttribute('aria-selected', btn.dataset.tab === tab ? 'true' : 'false');
    });
    els.account.querySelectorAll('.tabpage').forEach(function (el) {
      el.hidden = el.dataset.tabPage !== tab;
    });
  }
  els.authTabs.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    showAuthTab(btn.dataset.tab);
  });

  function openAccount(signedInUser, forceView) {
    els.account.querySelectorAll('.msg').forEach(function (m) { m.textContent = ''; });
    if (forceView) {
      showView(forceView);
    } else if (signedInUser) {
      els.meUsername.textContent = signedInUser.username || '';
      els.meEmail.textContent = signedInUser.email || '';
      showView('me');
    } else {
      showAuthTab('login');
      showView('auth');
    }
    els.account.classList.add('show');
  }
  function closeAccount() { els.account.classList.remove('show'); }
  function updateMe(user) {
    if (!user) return;
    els.meUsername.textContent = user.username || '';
    els.meEmail.textContent = user.email || '';
  }

  var ACCOUNT_ICON_SVG = '<svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="8.2" r="3.6"></circle>' +
    '<path d="M4.5 20c0-4.4 3.4-7 7.5-7s7.5 2.6 7.5 7"></path>' +
    '</svg>';

  function setAccountButtonLabel(user) {
    if (user) {
      els.btnAccount.classList.add('is-account');
      els.btnAccount.innerHTML = ACCOUNT_ICON_SVG;
      els.btnAccount.title = user.username || 'アカウント';
      els.btnAccount.setAttribute('aria-label', (user.username || 'アカウント') + '（ログイン中）');
    } else {
      els.btnAccount.classList.remove('is-account');
      els.btnAccount.textContent = 'ログイン';
      els.btnAccount.removeAttribute('title');
      els.btnAccount.setAttribute('aria-label', 'ログイン');
    }
  }

  els.btnAccount.addEventListener('click', function () {
    if (handlers.onAccountButton) handlers.onAccountButton();
  });

  els.account.addEventListener('click', function (e) {
    var goto = e.target.closest('[data-goto]');
    if (!goto) return;
    var raw = goto.dataset.goto;
    if (raw === 'close') { closeAccount(); return; }
    var target = raw === 'back' ? accountBackView : raw;
    showView(target);
    if (target === 'kifu' && handlers.onKifuListOpen) handlers.onKifuListOpen();
  });

  els.account.querySelector('form[data-tab-page="login"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onSignIn) handlers.onSignIn(f.email.value, f.password.value);
  });
  els.account.querySelector('form[data-tab-page="signup"]').addEventListener('submit', function (e) {
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
  els.account.querySelector('form[data-view="change-name"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onChangeName) handlers.onChangeName(f.username.value);
  });
  els.account.querySelector('form[data-view="change-email"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (handlers.onChangeEmail) handlers.onChangeEmail(f.email.value);
  });
  els.account.querySelector('form[data-view="change-password"]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.next.value !== f.confirm.value) {
      setMsg('change-password', '新しいパスワード（確認）が一致しません。', false);
      return;
    }
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

  /* ---------- 遊び方チュートリアル ---------- */

  var TUT_SLIDES = [
    {
      eyebrow: '1 / 4',
      headline: '重力で落ちるコマ',
      body: '棒の上をタップすると、コマが<b>重力に従って一番下の空いている段</b>まで落ちます。白と黒が交互に手番を進めます。',
      stage: function () {
        return '<div class="demo-peg">' +
          '<div class="demo-slot" style="top:0;"></div>' +
          '<div class="demo-slot" style="top:30px;"></div>' +
          '<div class="demo-slot" style="top:60px;"></div>' +
          '<div class="demo-slot" style="top:90px;"></div>' +
          '<div class="demo-ball" style="--stop:90px;animation:tutDropBall 1.3s cubic-bezier(.3,.6,.4,1) forwards;"></div>' +
        '</div>';
      }
    },
    {
      eyebrow: '2 / 4',
      headline: '視点はドラッグ、ズームはホイール',
      body: '画面をドラッグすると盤をぐるっと<b>回転</b>、ホイールやピンチで<b>ズーム</b>して好きな角度から確認できます。',
      stage: function () {
        return '<div class="tut-orbit">' +
          '<div class="orbit-cube">' +
            '<div class="face f1"></div><div class="face f2"></div><div class="face f3"></div>' +
            '<div class="face f4"></div><div class="face f5"></div><div class="face f6"></div>' +
          '</div>' +
          '<svg class="orbit-hand" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#e8b94a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M9 11.5V5.2a1.6 1.6 0 0 1 3.2 0V11"></path>' +
            '<path d="M12.2 11V4a1.6 1.6 0 0 1 3.2 0v7.4"></path>' +
            '<path d="M15.4 11.6V6.4a1.6 1.6 0 0 1 3.2 0V14c0 4-2.6 7-6.6 7-2.6 0-4-1-5.4-2.8L4 14.6c-.6-.9-.3-1.9.5-2.3.8-.4 1.7-.1 2.3.6l1.2 1.5"></path>' +
          '</svg>' +
        '</div>';
      }
    },
    {
      eyebrow: '3 / 4',
      headline: '4つ揃えたら勝ち',
      body: '<b>縦・横・斜め</b>、方向を問わず4つ並べれば勝利です。ライン(直線)は盤全体で<b>76通り</b>あります。',
      stage: function () {
        function ball(cx, cy) { return '<circle class="mini-ball" cx="' + cx + '" cy="' + cy + '" r="8.5" fill="url(#tut-ballGrad)"></circle>'; }
        var pts = [14, 35.33, 56.66, 78];
        var horiz = '<svg viewBox="0 0 92 92"><line class="mini-line len-straight" x1="14" y1="46" x2="78" y2="46"></line>' +
          pts.map(function (x) { return ball(x, 46); }).join('') + '</svg>';
        var vert = '<svg viewBox="0 0 92 92"><line class="mini-line len-straight" x1="46" y1="14" x2="46" y2="78"></line>' +
          pts.map(function (y) { return ball(46, y); }).join('') + '</svg>';
        var diag = '<svg viewBox="0 0 92 92"><line class="mini-line len-diag" x1="14" y1="14" x2="78" y2="78"></line>' +
          pts.map(function (p) { return ball(p, p); }).join('') + '</svg>';
        return '<div class="tut-winlines">' +
          '<div class="tut-winline-item">' + horiz + '<span>横</span></div>' +
          '<div class="tut-winline-item">' + vert + '<span>縦</span></div>' +
          '<div class="tut-winline-item">' + diag + '<span>斜め</span></div>' +
        '</div>';
      }
    },
    {
      eyebrow: '4 / 4',
      headline: 'メニューといつでも見返せる遊び方',
      body: '「待った」「棋譜」「設定」から対局を調整。困ったら右上の <b>？ボタン</b> でこのデモをいつでも見返せます。',
      stage: function () {
        return '<div class="tut-menurow">' +
          '<div class="tut-menu-item"><div class="tut-menu-icon"><svg viewBox="0 0 24 24"><path d="M9 8L4 12l5 4"></path><path d="M4 12h11a4.5 4.5 0 0 1 0 9h-2"></path></svg></div>待った</div>' +
          '<div class="tut-menu-item"><div class="tut-menu-icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg></div>棋譜</div>' +
          '<div class="tut-menu-item"><div class="tut-menu-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.7a7.7 7.7 0 0 0-2.6-1.5L14 2h-4l-.4 2.7a7.7 7.7 0 0 0-2.6 1.5l-2.4-.7-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.7a7.7 7.7 0 0 0 2.6 1.5L10 22h4l.4-2.7a7.7 7.7 0 0 0 2.6-1.5l2.4.7 2-3.4-2-1.6Z"></path></svg></div>設定</div>' +
          '<div class="tut-menu-item"><div class="tut-menu-icon qmark">？</div>遊び方</div>' +
        '</div>';
      }
    }
  ];

  var tutIdx = 0;

  function renderTutorialSlide() {
    var s = TUT_SLIDES[tutIdx];
    els.tutEyebrow.textContent = s.eyebrow;
    els.tutHeadline.textContent = s.headline;
    els.tutBody.innerHTML = s.body;
    els.tutStage.innerHTML = s.stage();
    els.tutDots.querySelectorAll('span').forEach(function (dot, i) {
      dot.classList.toggle('active', i === tutIdx);
    });
    els.tutPrev.disabled = tutIdx === 0;
    els.tutNext.textContent = tutIdx === TUT_SLIDES.length - 1 ? 'はじめる' : '次へ';
  }
  function openTutorial() {
    tutIdx = 0;
    renderTutorialSlide();
    els.tutorial.classList.add('show');
  }
  function closeTutorial() { els.tutorial.classList.remove('show'); }

  els.btnHelp.addEventListener('click', openTutorial);
  els.tutSkip.addEventListener('click', closeTutorial);
  els.tutPrev.addEventListener('click', function () { if (tutIdx > 0) { tutIdx--; renderTutorialSlide(); } });
  els.tutNext.addEventListener('click', function () {
    if (tutIdx < TUT_SLIDES.length - 1) { tutIdx++; renderTutorialSlide(); }
    else { closeTutorial(); }
  });

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
    renderKifuList: renderKifuList,
    openTutorial: openTutorial,
    closeTutorial: closeTutorial
  };
})();
