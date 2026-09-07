/* ============================================================
   立体4目並べ — 画面まわり（DOM操作）
   3D描画やゲームロジックには触れず、ボタン・ダイアログ・フォームの
   見た目と入力だけを担当する。main.js から UI.init(handlers) で
   コールバックを渡して使う。

   window.ScoreFourUI として公開する。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    title: $('title'),
    turnDot: $('turn-dot'), turnLabel: $('turn-label'), cpuThinking: $('cpu-thinking'),
    status: $('status'),
    btnUndo: $('btn-undo'), btnLog: $('btn-log'), btnSettings: $('btn-settings'), btnReset: $('btn-reset'),
    btnHelp: $('btn-help'), btnAccount: $('btn-account'),
    logWrap: $('log-wrap'), log: $('log'),
    clock: $('clock'),

    tutorial: $('tutorial'), tutSkip: $('tut-skip'), tutEyebrow: $('tut-eyebrow'), tutHeadline: $('tut-headline'),
    tutStage: $('tut-stage'), tutBody: $('tut-body'), tutDots: $('tut-dots'), tutPrev: $('tut-prev'), tutNext: $('tut-next'),

    endcard: $('endcard'), endHeadline: $('end-headline'), endSub: $('end-sub'),
    saveAsk: $('save-ask'), saveDone: $('save-done'),
    btnSaveYes: $('btn-save-yes'), btnSaveNo: $('btn-save-no'), btnAgain: $('btn-again'),

    confirmReset: $('confirm-reset'), btnResetCancel: $('btn-reset-cancel'), btnResetConfirm: $('btn-reset-confirm'),

    settings: $('settings'), variantPills: $('variant-pills'),
    modePills: $('mode-pills'), cpuOptions: $('cpu-options'),
    cpuLevel: $('cpu-level'), cpuLevelLabel: $('cpu-level-label'),
    undoEnabled: $('undo-enabled'), undoLimitRow: $('undo-limit-row'), undoLimit: $('undo-limit'),
    clockEnabled: $('clock-enabled'), clockOptions: $('clock-options'),
    clockSeconds: $('clock-seconds'), clockDisplayPills: $('clock-display-pills'),
    bgPills: $('background-pills'),
    btnSettingsCancel: $('btn-settings-cancel'), btnSettingsApply: $('btn-settings-apply'),

    account: $('account'), authTabs: $('auth-tabs'), meUsername: $('me-username'), meEmail: $('me-email'),
    btnSignout: $('btn-signout'), kifuList: $('kifu-list')
  };

  var handlers = {};
  var pendingFirst = 'human';
  var pendingMode = 'pvp';
  var pendingBackground = 'dark';
  var pendingVariant = 4;
  var pendingClockDisplay = 'analog';
  var currentAccountView = 'auth';
  var accountBackView = 'auth';

  function playerName(p) { return p === 1 ? '白' : '黒'; }

  function setGameTitle(text) { els.title.textContent = text; }

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

  function paintVariantPills() {
    var btns = els.variantPills.querySelectorAll('.pill');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.variant === String(pendingVariant));
  }
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
  function paintClockRow() {
    els.clockOptions.classList.toggle('disabled', !els.clockEnabled.checked);
  }
  function paintClockDisplayPills() {
    var btns = els.clockDisplayPills.querySelectorAll('.pill');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.clockdisp === pendingClockDisplay);
  }
  function paintBgPills() {
    var btns = els.bgPills.querySelectorAll('.pill');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.bg === pendingBackground);
  }

  function openSettings(current) {
    pendingVariant = current.variant || 4;
    pendingMode = current.mode;
    pendingFirst = current.humanFirst ? 'human' : 'cpu';
    pendingBackground = current.background || 'dark';
    pendingClockDisplay = current.clockDisplay === 'digital' ? 'digital' : 'analog';
    els.clockEnabled.checked = !!current.clockEnabled;
    els.clockSeconds.value = String(current.clockSeconds || 30);
    els.cpuLevel.value = current.cpuLevel;
    els.cpuLevelLabel.textContent = 'レベル ' + current.cpuLevel;
    els.undoEnabled.checked = current.undoEnabled;
    els.undoLimit.value = current.undoLimit == null ? 'unlimited' : String(current.undoLimit);
    paintVariantPills(); paintModePills(); paintFirstPills(); paintUndoRow();
    paintClockRow(); paintClockDisplayPills(); paintBgPills();
    els.settings.classList.add('show');
  }
  function closeSettings() { els.settings.classList.remove('show'); }

  els.variantPills.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-variant]');
    if (!btn) return;
    pendingVariant = parseInt(btn.dataset.variant, 10);
    paintVariantPills();
  });
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
  els.clockEnabled.addEventListener('change', paintClockRow);
  els.clockDisplayPills.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-clockdisp]');
    if (!btn) return;
    pendingClockDisplay = btn.dataset.clockdisp;
    paintClockDisplayPills();
  });
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
      variant: pendingVariant,
      mode: pendingMode,
      cpuLevel: parseInt(els.cpuLevel.value, 10),
      humanFirst: pendingFirst === 'human',
      undoEnabled: els.undoEnabled.checked,
      undoLimit: limitVal === 'unlimited' ? null : parseInt(limitVal, 10),
      clockEnabled: els.clockEnabled.checked,
      clockSeconds: parseInt(els.clockSeconds.value, 10),
      clockDisplay: pendingClockDisplay,
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


  /* ---------- 対局クロック（表示） ----------
     残り時間の管理は main.js が持ち、ここは受け取った値を描くだけにする。 */

  var GAUGE_R = 21;
  var GAUGE_LEN = 2 * Math.PI * GAUGE_R;
  var clockMode = 'analog';
  var clockFaces = {};   // player番号 → { root, gauge, hand, digits }

  function analogFaceHtml() {
    return '<svg viewBox="0 0 56 56" aria-hidden="true">' +
      '<circle class="cf-plate" cx="28" cy="28" r="25"></circle>' +
      '<circle class="cf-track" cx="28" cy="28" r="' + GAUGE_R + '"></circle>' +
      '<circle class="cf-gauge" cx="28" cy="28" r="' + GAUGE_R + '" stroke-dasharray="' + GAUGE_LEN.toFixed(2) + '"></circle>' +
      '<line class="cf-tick" x1="28" y1="4.5" x2="28" y2="8"></line>' +
      '<line class="cf-tick" x1="51.5" y1="28" x2="48" y2="28"></line>' +
      '<line class="cf-tick" x1="28" y1="51.5" x2="28" y2="48"></line>' +
      '<line class="cf-tick" x1="4.5" y1="28" x2="8" y2="28"></line>' +
      '<line class="cf-hand" x1="28" y1="28" x2="28" y2="10"></line>' +
      '<circle class="cf-hub" cx="28" cy="28" r="2.2"></circle>' +
    '</svg>';
  }

  // 10秒以上は 分:秒、それ未満は 秒.コンマ1桁（終盤の緊張感が伝わるように）
  function formatClock(ms) {
    if (ms >= 10000) {
      var total = Math.ceil(ms / 1000);
      return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    }
    return (Math.ceil(ms / 100) / 10).toFixed(1);
  }

  function setupClock(opts) {
    var on = !!(opts && opts.enabled);
    els.clock.hidden = !on;
    clockFaces = {};
    if (!on) { els.clock.innerHTML = ''; return; }

    clockMode = opts.display === 'digital' ? 'digital' : 'analog';
    els.clock.innerHTML = [1, 2].map(function (p) {
      return '<div class="clock-face" data-player="' + p + '">' +
        (clockMode === 'analog' ? analogFaceHtml() : '<span class="cf-digits">-:--</span>') +
        '<span class="cf-label">' + playerName(p) + '</span>' +
      '</div>';
    }).join('');

    els.clock.querySelectorAll('.clock-face').forEach(function (root) {
      clockFaces[root.dataset.player] = {
        root: root,
        gauge: root.querySelector('.cf-gauge'),
        hand: root.querySelector('.cf-hand'),
        digits: root.querySelector('.cf-digits')
      };
    });
  }

  function paintFace(f, remainMs, totalMs, active) {
    var frac = totalMs > 0 ? Math.max(0, Math.min(1, remainMs / totalMs)) : 0;
    f.root.classList.toggle('active', active);
    // 残り5秒以下（短い持ち時間では残り1/4以下）で警告表示に切り替える
    f.root.classList.toggle('low', active && remainMs <= Math.min(5000, totalMs / 4));

    if (f.gauge) {
      // 残り時間ぶんの円弧を12時から時計回りに描き、針をその先端に置く
      f.gauge.style.strokeDashoffset = (GAUGE_LEN * (1 - frac)).toFixed(2);
      f.hand.style.transform = 'rotate(' + (frac * 360).toFixed(1) + 'deg)';
    }
    if (f.digits) {
      var text = formatClock(remainMs);
      if (f.digits.textContent !== text) f.digits.textContent = text;
    }
  }

  function updateClock(activePlayer, remainMs, totalMs) {
    var active = clockFaces[activePlayer];
    if (active) paintFace(active, remainMs, totalMs, true);
    // 手番でない側は、次に回ってきたときの持ち時間（＝満タン）を見せておく
    var idle = clockFaces[activePlayer === 1 ? 2 : 1];
    if (idle) paintFace(idle, totalMs, totalMs, false);
  }

  /* ---------- 遊び方チュートリアル ---------- */

  /* 勝ちライン図（Three.js）。実機の盤と同じWebGLで描くので、棒が玉を貫いていても
     画素単位で前後が決まり、回転させても前後関係が入れ替わってチラつくことがない。 */
  var liveBoards = [];
  function disposeBoards() {
    liveBoards.forEach(function (b) {
      cancelAnimationFrame(b.raf);
      b.renderer.dispose();
      if (b.renderer.forceContextLoss) b.renderer.forceContextLoss();
      if (b.renderer.domElement && b.renderer.domElement.parentNode) {
        b.renderer.domElement.parentNode.removeChild(b.renderer.domElement);
      }
    });
    liveBoards.length = 0;
  }

  function buildWinBoard(host, n) {
    if (typeof THREE === 'undefined' || !host) return;

    var W = 150;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) { return; }   // WebGLが使えない環境では図を出さずに進む
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, W);
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffe7bd, 0x241a10, 0.55));
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    var key = new THREE.DirectionalLight(0xfff2d8, 0.95);
    key.position.set(3, 5.5, 2.5);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xc9982f, 0.4);
    rim.position.set(-3, 1.5, -3);
    scene.add(rim);

    var SP = 0.5, BR = 0.24, PEG_R = 0.055;
    function px(i) { return (i - (n - 1) / 2) * SP; }
    function py(z) { return z * SP + BR; }

    // 実機の白玉と同じ色。暗い背景に沈まないよう、ごく弱い自発光を足している。
    var ballMat = new THREE.MeshStandardMaterial({
      color: 0xf3ead9, roughness: 0.3, metalness: 0.06,
      emissive: 0x4a423a, emissiveIntensity: 0.35
    });
    // 金属らしさは metalness ではなく明るさで出す。環境マップが無い場面で
    // metalness を上げると反射する物が無く、かえって黒く沈んでしまうため。
    var steelMat = new THREE.MeshStandardMaterial({ color: 0x8b949c, roughness: 0.38, metalness: 0.25 });
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x4d5359, roughness: 0.7, metalness: 0.1 });

    var baseSize = (n - 1) * SP + SP + 0.16;
    var base = new THREE.Mesh(new THREE.BoxGeometry(baseSize, 0.09, baseSize), baseMat);
    base.position.y = -0.045;
    scene.add(base);

    // 角を共有する5本のライン（横2方向・縦・面の斜め・立体の斜め）。重なる玉は1つだけ置く
    var cells = [], seen = {}, i;
    function add(x, y, z) {
      var k = x + '_' + y + '_' + z;
      if (seen[k]) return;
      seen[k] = 1;
      cells.push([x, y, z]);
    }
    for (i = 0; i < n; i++) add(i, 0, 0);   // 横（手前→奥）
    for (i = 0; i < n; i++) add(0, i, 0);   // 横（左→右）
    for (i = 0; i < n; i++) add(0, 0, i);   // 縦
    for (i = 0; i < n; i++) add(i, 0, i);   // 面の斜め
    for (i = 0; i < n; i++) add(i, i, i);   // 立体の斜め

    // 棒は玉が載っている柱にだけ立て、玉を貫いて上へ突き出させる
    var colTop = {};
    cells.forEach(function (c) {
      var k = c[0] + '_' + c[1];
      if (colTop[k] === undefined || c[2] > colTop[k]) colTop[k] = c[2];
    });
    Object.keys(colTop).forEach(function (k) {
      var xy = k.split('_');
      var h = py(colTop[k]) + BR * 1.9;
      var peg = new THREE.Mesh(new THREE.CylinderGeometry(PEG_R, PEG_R * 1.1, h, 12), steelMat);
      peg.position.set(px(+xy[0]), h / 2, px(+xy[1]));
      scene.add(peg);
    });

    var ballGeo = new THREE.SphereGeometry(BR, 26, 18);
    cells.forEach(function (c) {
      var ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.set(px(c[0]), py(c[2]), px(c[1]));
      scene.add(ball);
    });

    // 3目・4目・5目で見かけの大きさが揃うように、中身を囲む球から距離を決める
    var topY = py(n - 1) + BR * 1.9;             // 一番高い棒の先端
    var centerY = topY / 2;
    var radius = Math.max(centerY + BR, baseSize * 0.71);
    var reach = radius / Math.tan(34 * Math.PI / 360) * 1.22;
    var phi = 0.72;
    var target = new THREE.Vector3(0, centerY, 0);

    var t0 = performance.now();
    var entry = { renderer: renderer, raf: 0 };
    function frame(now) {
      var theta = Math.PI * 0.25 + (now - t0) / 1000 * 0.42;   // 約15秒で1回転
      camera.position.set(
        target.x + reach * Math.sin(phi) * Math.sin(theta),
        target.y + reach * Math.cos(phi),
        target.z + reach * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
      entry.raf = requestAnimationFrame(frame);
    }
    entry.raf = requestAnimationFrame(frame);
    liveBoards.push(entry);
  }

  /* 立方体の回転。--spin をフレームごとに1回だけ書き、立方体と玉を同じ値で動かす */
  var spinRaf = null;
  function stopSpin() {
    if (spinRaf) { cancelAnimationFrame(spinRaf); spinRaf = null; }
  }
  function startSpin(degPerSec) {
    stopSpin();
    var scenes = els.tutStage.querySelectorAll('.cube-scene');
    if (!scenes.length) return;
    var t0 = performance.now();
    function step(now) {
      var deg = ((now - t0) / 1000 * degPerSec) % 360;
      for (var i = 0; i < scenes.length; i++) scenes[i].style.setProperty('--spin', deg.toFixed(2) + 'deg');
      spinRaf = requestAnimationFrame(step);
    }
    spinRaf = requestAnimationFrame(step);
  }

  var TUT_SLIDES = [
    {
      eyebrow: '1 / 6',
      headline: '重力で落ちるコマ',
      body: '棒の上をタップすると、コマが<b>重力に従って一番下の空いている段</b>まで落ちます。白と黒が交互に手番を進めます。',
      stage: function (el) {
        el.innerHTML = '<div class="demo-peg">' +
          '<div class="demo-slot" style="top:0;"></div>' +
          '<div class="demo-slot" style="top:30px;"></div>' +
          '<div class="demo-slot" style="top:60px;"></div>' +
          '<div class="demo-slot" style="top:90px;"></div>' +
          '<div class="demo-ball" style="--stop:90px;animation:tutDropBall 1.3s cubic-bezier(.3,.6,.4,1) forwards;"></div>' +
        '</div>';
      }
    },
    {
      eyebrow: '2 / 6',
      headline: '遊べる盤の種類',
      body: '設定の「ゲームの種類」から<b>立体3目並べ・立体4目並べ・立体5目並べ</b>を選べます。盤の大きさが変わるだけで、遊び方やルールはすべて共通です。',
      stage: function (el) {
        // 玉を全部詰めた立方体（27個 / 64個 / 125個）で盤の大きさの違いを見せる。
        // 内側の玉は外からは絶対に見えないので描かない（描画を軽くするため）。
        var D = 8;   // 玉の直径。玉の大きさは共通なので、目数が増えるほど立方体が大きくなる
        function cube(n) {
          var s = (n - 1) * D / 2;
          function pos(i) { return -s + i * D; }
          var html = '';
          for (var x = 0; x < n; x++) {
            for (var y = 0; y < n; y++) {
              for (var z = 0; z < n; z++) {
                var onShell = (x === 0 || x === n - 1 || y === 0 || y === n - 1 || z === 0 || z === n - 1);
                if (!onShell) continue;
                var color = (x + y + z) % 2 === 0 ? 'w' : 'b';
                html += '<div class="cube-pos" style="transform:translate3d(' + pos(x) + 'px,' + pos(y) + 'px,' + pos(z) + 'px);">' +
                  '<div class="cbball cube-face ' + color + '" style="width:' + D + 'px;height:' + D + 'px;' +
                  'margin:' + (-D / 2) + 'px 0 0 ' + (-D / 2) + 'px;"></div></div>';
              }
            }
          }
          var box = Math.round(n * D * 1.5 + 18);
          return '<div style="position:relative;width:' + box + 'px;height:' + box + 'px;perspective:700px;">' +
            '<div class="cube-scene">' + html + '</div></div>';
        }
        el.innerHTML = '<div class="tut-variants">' +
          [[3, '3目並べ', '3×3×3', 27], [4, '4目並べ', '4×4×4', 64], [5, '5目並べ', '5×5×5', 125]].map(function (v) {
            return '<div class="tut-variant-item">' + cube(v[0]) +
              '<span><b>' + v[1] + '</b>' + v[2] + '<br>玉' + v[3] + '個</span></div>';
          }).join('') +
        '</div>';
      }
    },
    {
      eyebrow: '3 / 6',
      headline: '視点はドラッグ、ズームはホイール',
      body: '画面をドラッグすると盤をぐるっと<b>回転</b>、ホイールやピンチで<b>ズーム</b>して好きな角度から確認できます。',
      stage: function (el) {
        el.innerHTML = '<div class="tut-orbit">' +
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
      eyebrow: '4 / 6',
      headline: '選んだ目数だけ揃えたら勝ち',
      body: '<b>縦・横・斜め</b>、どの向きでも同じ色の玉が<b>4つ</b>並べば勝ちです。',
      stage: function (el) {
        function render(n) {
          disposeBoards();   // タブを押し替えるたび、古いWebGLの描画ループを畳む
          el.innerHTML = '<div class="wincand">' +
            '<div class="wintabs">' +
              [3, 4, 5].map(function (v) {
                return '<button type="button" class="wintab' + (v === n ? ' active' : '') + '" data-n="' + v + '">' + v + '目</button>';
              }).join('') +
            '</div>' +
            '<div class="wb3d"></div>' +
          '</div>';

          buildWinBoard(el.querySelector('.wb3d'), n);
          els.tutBody.innerHTML = '<b>縦・横・斜め</b>、どの向きでも同じ色の玉が<b>' + n + 'つ</b>並べば勝ちです。';

          el.querySelector('.wintabs').addEventListener('click', function (e) {
            var btn = e.target.closest('.wintab');
            if (btn) render(parseInt(btn.dataset.n, 10));
          });
        }
        render(4);
      }
    },
    {
      eyebrow: '5 / 6',
      headline: '対局クロックで緊張感をプラス',
      body: '設定で「対局クロック」をオンにすると、<b>1手ごとの持ち時間(10秒〜3分)</b>が減っていきます。指すと相手側に切り替わってリセットされ、0になった側の負けです。アナログ・デジタルから表示も選べます。',
      stage: function (el) {
        function dial(active) {
          return '<svg viewBox="0 0 56 56">' +
            '<circle class="face" cx="28" cy="28" r="25"></circle>' +
            (active ? '<path class="wedge" d="M28,28 L28,3 A25,25 0 0 1 45.7,45.7 Z"></path>' : '') +
            '<line class="tick" x1="28" y1="5" x2="28" y2="9"></line>' +
            '<line class="tick" x1="51" y1="28" x2="47" y2="28"></line>' +
            '<line class="tick" x1="28" y1="51" x2="28" y2="47"></line>' +
            '<line class="tick" x1="5" y1="28" x2="9" y2="28"></line>' +
            '<line class="hand" x1="28" y1="28" x2="' + (active ? '45.7' : '28') + '" y2="' + (active ? '45.7' : '9') + '"></line>' +
            '<circle class="hub" cx="28" cy="28" r="2.2"></circle>' +
          '</svg>';
        }
        el.innerHTML = '<div class="tut-clockrow">' +
          '<div class="tut-clockface active">' + dial(true) + '<span>白 (手番)</span></div>' +
          '<div class="tut-clockface">' + dial(false) + '<span>黒</span></div>' +
        '</div>';
      }
    },
    {
      eyebrow: '6 / 6',
      headline: 'メニューといつでも見返せる遊び方',
      body: '「待った」「棋譜」「設定」から対局を調整。困ったら右上の <b>？ボタン</b> でこのデモをいつでも見返せます。',
      stage: function (el) {
        el.innerHTML = '<div class="tut-menurow">' +
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
    stopSpin();
    disposeBoards();
    els.tutEyebrow.textContent = s.eyebrow;
    els.tutHeadline.textContent = s.headline;
    els.tutBody.innerHTML = s.body;
    s.stage(els.tutStage);
    startSpin(33);   // 約11秒で1回転
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
  function closeTutorial() {
    stopSpin();
    disposeBoards();
    els.tutStage.innerHTML = '';
    els.tutorial.classList.remove('show');
  }

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
    setupClock: setupClock,
    updateClock: updateClock,
    openTutorial: openTutorial,
    closeTutorial: closeTutorial,
    setGameTitle: setGameTitle
  };
})();
