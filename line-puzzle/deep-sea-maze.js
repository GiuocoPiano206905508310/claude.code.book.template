/* ============================================================
   深海迷路 (Deep Sea Maze)
   360度ジョイスティックで深海探査船を操作し、自由曲線の海底洞窟迷路を
   探索してゴールを目指すアクションパズル。ステージデータ(dsm-levels.js)は
   tools/gen-dsm-levels.mjs で事前生成・検証済みのもの(実行時には迷路を
   生成しない)。
   ・当たり判定は「通路の中心線までの距離」ベースで、描画とまったく同じ
     点列(stage.segments)から作るためズレない。
   ・進行状況の保存は、ラインパズル本編(game.js)と同じ入れ物を通す
     （block-fit-puzzle.js と同じやり方）。ログイン中はアカウントに
     紐づいてクラウドへも保存される。
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var LEVELS = window.DSM_LEVELS || [];
  var TOTAL_STAGES = LEVELS.length;
  function bandOf(stageId) { return Math.min(6, Math.floor((stageId - 1) / 5) + 1); }

  var DEBUG = /(?:^|[?&])dsmdebug=1(?:&|$)/.test(window.location.search);

  /* ============================================================
     進行状況（クリア済みステージ）
     ラインパズル本編の保存先に相乗りし、アカウントに紐づける。
     ============================================================ */
  var PROGRESS_KEY = 'deepSeaMaze.progress.v1';
  function currentUser() {
    var cloud = window.LinePuzzleCloud || null;
    return cloud ? cloud.user() : null;
  }
  function progressStoreKey() {
    var u = currentUser();
    return u ? PROGRESS_KEY + ':' + u.id : PROGRESS_KEY;
  }
  function progressHub() {
    var g = window.LinePuzzleGame;
    return (g && g.readDeepSeaMaze && g.saveDeepSeaMaze) ? g : null;
  }
  function blankProgress() { return { cleared: {}, lastStage: 1 }; }
  function readLocal() {
    try {
      var raw = window.localStorage.getItem(progressStoreKey());
      var data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== 'object') return blankProgress();
      if (!data.cleared || typeof data.cleared !== 'object') data.cleared = {};
      if (!data.lastStage) data.lastStage = 1;
      return data;
    } catch (e) { return blankProgress(); }
  }
  function loadProgress() {
    var hub = progressHub();
    if (!hub) return readLocal();
    var stored = hub.readDeepSeaMaze();
    if (!stored || typeof stored !== 'object') return blankProgress();
    if (!stored.cleared) stored.cleared = {};
    if (!stored.lastStage) stored.lastStage = 1;
    return stored;
  }
  function saveProgress() {
    var hub = progressHub();
    if (hub) { hub.saveDeepSeaMaze(progress); return; }
    try { window.localStorage.setItem(progressStoreKey(), JSON.stringify(progress)); } catch (e) { /* 保存できなくても遊べる */ }
  }

  var progress = loadProgress();
  function highestUnlocked() {
    var maxCleared = 0;
    Object.keys(progress.cleared).forEach(function (k) { maxCleared = Math.max(maxCleared, +k); });
    return Math.min(TOTAL_STAGES, maxCleared + 1);
  }
  function isUnlocked(id) { return id <= highestUnlocked(); }
  function markCleared(id) {
    if (progress.cleared[id]) return false;
    progress.cleared[id] = true;
    saveProgress();
    return true;
  }
  function setLastStage(id) {
    progress.lastStage = id;
    saveProgress();
  }

  /* ============================================================
     画面切り替え
     ============================================================ */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    $(id).classList.add('is-active');
  }
  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }
  function anyDsmModalOpen() {
    return !$('modal-dsm-pause').hidden || !$('modal-dsm-clear').hidden || !$('modal-dsm-help').hidden;
  }

  /* ============================================================
     ステージ選択画面
     ============================================================ */
  function stageButton(id) {
    var li = el('li');
    var btn = el('button', 'stage-btn');
    btn.type = 'button';
    if (!isUnlocked(id)) {
      btn.classList.add('is-locked');
      btn.disabled = true;
      btn.innerHTML = '<svg class="ic"><use href="#ic-lock"/></svg>';
      btn.setAttribute('aria-label', 'Stage ' + id + '（未開放）');
    } else {
      btn.textContent = String(id).length < 2 ? '0' + id : String(id);
      btn.setAttribute('aria-label', 'Stage ' + id);
      if (progress.cleared[id]) {
        btn.classList.add('is-cleared', 'dsm-band-' + bandOf(id));
      } else if (id === highestUnlocked()) {
        btn.classList.add('is-next');
      }
      btn.addEventListener('click', function () { openGame(id); });
    }
    li.appendChild(btn);
    return li;
  }

  function fillGrid() {
    var grid = $('dsm-stage-grid');
    grid.innerHTML = '';
    for (var i = 1; i <= TOTAL_STAGES; i++) grid.appendChild(stageButton(i));
  }

  function renderSelect() {
    progress = loadProgress();
    var done = Object.keys(progress.cleared).length;
    $('dsm-select-progress').textContent = 'クリア ' + done + ' / ' + TOTAL_STAGES;
    fillGrid();
  }

  var syncHooked = false;
  function hookProgressSync() {
    if (syncHooked) return;
    var hub = progressHub();
    if (!hub || !hub.onProgressSync) return;
    syncHooked = true;
    hub.onProgressSync(function () {
      if ($('screen-dsm-select').classList.contains('is-active')) renderSelect();
    });
  }

  function openSelect() {
    stopLoop();
    hookProgressSync();
    renderSelect();
    showScreen('screen-dsm-select');
  }

  $('dsm-select-back').addEventListener('click', function () { window.openGameSelect(); });
  $('dsm-select-help').addEventListener('click', function () { openModal('modal-dsm-help'); });
  $('dsm-help').addEventListener('click', function () { openModal('modal-dsm-help'); });
  $('dsm-help-close').addEventListener('click', function () { closeModal('modal-dsm-help'); });

  /* ============================================================
     当たり判定（空間バケットで高速化）
     ・stage.segments の点列がそのまま描画にも当たり判定にも使われるため、
       見た目とヒットボックスは絶対にズレない。
     ============================================================ */
  var BUCKET = 90;
  function buildCollisionIndex(stage) {
    var subSegs = [];
    stage.segments.forEach(function (seg) {
      var halfW = seg.width / 2;
      for (var i = 0; i < seg.points.length - 1; i++) {
        subSegs.push({
          ax: seg.points[i][0], ay: seg.points[i][1],
          bx: seg.points[i + 1][0], by: seg.points[i + 1][1],
          halfW: halfW
        });
      }
    });
    var map = {};
    subSegs.forEach(function (s, i) {
      var minX = Math.min(s.ax, s.bx) - s.halfW, maxX = Math.max(s.ax, s.bx) + s.halfW;
      var minY = Math.min(s.ay, s.by) - s.halfW, maxY = Math.max(s.ay, s.by) + s.halfW;
      var cx0 = Math.floor(minX / BUCKET), cx1 = Math.floor(maxX / BUCKET);
      var cy0 = Math.floor(minY / BUCKET), cy1 = Math.floor(maxY / BUCKET);
      for (var cy = cy0; cy <= cy1; cy++) {
        for (var cx = cx0; cx <= cx1; cx++) {
          var k = cx + '_' + cy;
          if (!map[k]) map[k] = [];
          map[k].push(i);
        }
      }
    });
    return { subSegs: subSegs, map: map };
  }
  function distPointSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var ex = ax + dx * t, ey = ay + dy * t;
    return Math.hypot(px - ex, py - ey);
  }
  // 点から線分への最短点(壁の法線方向を求めるのに使う)
  function closestPointOnSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return { x: ax + dx * t, y: ay + dy * t, tx: dx, ty: dy };
  }
  function isPassable(index, shipR, x, y) {
    var cx = Math.floor(x / BUCKET), cy = Math.floor(y / BUCKET);
    for (var gy = cy - 1; gy <= cy + 1; gy++) {
      for (var gx = cx - 1; gx <= cx + 1; gx++) {
        var arr = index.map[gx + '_' + gy];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var s = index.subSegs[arr[i]];
          if (distPointSeg(x, y, s.ax, s.ay, s.bx, s.by) <= s.halfW - shipR) return true;
        }
      }
    }
    return false;
  }
  // 現在地点で「いちばん収まりがいい(壁までいちばん余裕がある)」通路を探し、
  // その通路の中心線から見た外向きの法線を返す。斜め・カーブした壁でも、
  // 上下左右2方向だけに頼らず正しい向きへ壁ずりさせるために使う。
  function nearestWallNormal(index, shipR, x, y) {
    var cx = Math.floor(x / BUCKET), cy = Math.floor(y / BUCKET);
    var best = null, bestMargin = -Infinity;
    for (var gy = cy - 1; gy <= cy + 1; gy++) {
      for (var gx = cx - 1; gx <= cx + 1; gx++) {
        var arr = index.map[gx + '_' + gy];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var s = index.subSegs[arr[i]];
          var cp = closestPointOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
          var d = Math.hypot(x - cp.x, y - cp.y);
          var margin = (s.halfW - shipR) - d;
          if (margin > bestMargin) {
            bestMargin = margin;
            var nlen = d > 1e-6 ? d : 1e-6;
            best = { nx: (x - cp.x) / nlen, ny: (y - cp.y) / nlen };
          }
        }
      }
    }
    return best;
  }

  /* ============================================================
     ジョイスティック（Pointer Events で touch/mouse/pen 統一）
     ============================================================ */
  var stickZone = $('dsm-stick-zone'), stickBase = $('dsm-stick-base'), stickKnob = $('dsm-stick-knob');
  var stickPointerId = null;
  var stickVec = { x: 0, y: 0, mag: 0 };
  var DEADZONE = 0.16;

  function stickBaseRect() { return stickBase.getBoundingClientRect(); }

  function updateStickFromPointer(clientX, clientY) {
    var r = stickBaseRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = clientX - cx, dy = clientY - cy;
    var dist = Math.hypot(dx, dy);
    var maxDist = r.width / 2 - 8;
    var clamped = Math.min(dist, maxDist);
    var nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0;
    stickKnob.style.transition = 'none';
    stickKnob.style.transform = 'translate(calc(-50% + ' + (nx * clamped).toFixed(1) + 'px), calc(-50% + ' + (ny * clamped).toFixed(1) + 'px))';
    var rawMag = maxDist > 0 ? clamped / maxDist : 0;
    if (rawMag < DEADZONE) {
      stickVec.x = 0; stickVec.y = 0; stickVec.mag = 0;
    } else {
      var remapped = (rawMag - DEADZONE) / (1 - DEADZONE);
      stickVec.x = nx * remapped; stickVec.y = ny * remapped; stickVec.mag = remapped;
    }
  }
  function resetStick() {
    stickPointerId = null;
    stickVec.x = 0; stickVec.y = 0; stickVec.mag = 0;
    stickKnob.style.transition = 'transform .16s cubic-bezier(.2,.8,.3,1.2)';
    stickKnob.style.transform = 'translate(-50%, -50%)';
  }
  stickZone.addEventListener('pointerdown', function (ev) {
    if (!game || game.paused || !game.playing || anyDsmModalOpen()) return;
    if (stickPointerId !== null) return;
    ev.preventDefault();
    stickPointerId = ev.pointerId;
    try { stickZone.setPointerCapture(ev.pointerId); } catch (e) { /* 未対応環境は通常のイベントで続行 */ }
    updateStickFromPointer(ev.clientX, ev.clientY);
  });
  stickZone.addEventListener('pointermove', function (ev) {
    if (ev.pointerId !== stickPointerId) return;
    ev.preventDefault();
    updateStickFromPointer(ev.clientX, ev.clientY);
  });
  function onStickEnd(ev) {
    if (ev.pointerId !== stickPointerId) return;
    resetStick();
  }
  stickZone.addEventListener('pointerup', onStickEnd);
  stickZone.addEventListener('pointercancel', onStickEnd);
  stickZone.addEventListener('lostpointercapture', function () { if (stickPointerId !== null) resetStick(); });
  stickZone.addEventListener('touchmove', function (ev) { ev.preventDefault(); }, { passive: false });

  /* ============================================================
     ゲーム画面
     ============================================================ */
  var canvas = $('dsm-canvas');
  var ctx = canvas.getContext('2d');
  var game = null;   // { stage, index, ship:{x,y,angle,displayAngle}, camera, playing, paused, rafId }
  var MIN_SPEED = 66, MAX_SPEED = 232;   // px/秒
  var ANGLE_TAU = 0.09;   // 秒。向き変更の補間の速さ(約100〜200msで収束)
  var CAMERA_TAU = 0.16;
  var lastFrameTime = 0;
  var fps = 60;

  function setTheme(stageId) {
    var band = 'dsm-theme-' + bandOf(stageId);
    [$('screen-dsm-game'), $('screen-dsm-select')].forEach(function (target) {
      for (var i = 1; i <= 6; i++) target.classList.remove('dsm-theme-' + i);
      target.classList.add(band);
    });
  }

  function openGame(stageId) {
    var stage = LEVELS[stageId - 1];
    if (!stage) return;
    stopLoop();
    setTheme(stageId);
    setLastStage(stageId);
    $('dsm-stage-label').textContent = 'STAGE ' + stageId;
    game = {
      stageId: stageId,
      stage: stage,
      index: buildCollisionIndex(stage),
      ship: { x: stage.startPosition.x, y: stage.startPosition.y, angle: stage.startAngle, displayAngle: stage.startAngle },
      camera: { mode: 'fixed', scale: 1, cx: stage.mazeBounds.width / 2, cy: stage.mazeBounds.height / 2 },
      playing: true,
      paused: false,
      bubbles: makeBubbles(stage)
    };
    resetStick();
    showScreen('screen-dsm-game');
    resizeCanvas();
    requestAnimationFrame(resizeCanvas);
    flashStart();
    lastFrameTime = performance.now();
    game.rafId = requestAnimationFrame(loop);
  }

  function makeBubbles(stage) {
    var n = Math.min(26, Math.round((stage.mazeBounds.width * stage.mazeBounds.height) / 42000) + 10);
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * stage.mazeBounds.width,
        y: Math.random() * stage.mazeBounds.height,
        r: 1.2 + Math.random() * 2.6,
        speed: 8 + Math.random() * 14,
        drift: (Math.random() - 0.5) * 6,
        phase: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }

  function flashStart() {
    var f = $('dsm-start-flash');
    f.hidden = false;
    f.classList.remove('is-fading');
    void f.offsetWidth;
    f.classList.add('is-fading');
    setTimeout(function () { f.hidden = true; }, 1300);
  }

  function resetCurrentStage() {
    if (!game) return;
    var stage = game.stage;
    game.ship.x = stage.startPosition.x;
    game.ship.y = stage.startPosition.y;
    game.ship.angle = stage.startAngle;
    game.ship.displayAngle = stage.startAngle;
    game.camera.cx = stage.mazeBounds.width / 2;
    game.camera.cy = stage.mazeBounds.height / 2;
    game.playing = true;
    game.paused = false;
    resetStick();
    flashStart();
  }

  /* ---------- キャンバスサイズ（devicePixelRatio対応） ---------- */
  var cssW = 0, cssH = 0, dpr = 1;
  function resizeCanvas() {
    if (!game) return;
    var area = document.querySelector('#screen-dsm-game .dsm-canvas-area');
    if (!area) return;
    cssW = area.clientWidth; cssH = area.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    computeCamera();
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', function () { setTimeout(resizeCanvas, 200); });

  function computeCamera() {
    if (!game) return;
    var mw = game.stage.mazeBounds.width, mh = game.stage.mazeBounds.height;
    var fitScale = Math.min(cssW / mw, cssH / mh);
    if (fitScale >= 0.72) {
      game.camera.mode = 'fixed';
      game.camera.scale = clamp(fitScale, 0.4, 1.5);
      game.camera.cx = mw / 2;
      game.camera.cy = mh / 2;
    } else {
      game.camera.mode = 'follow';
      game.camera.scale = clamp(cssW / 430, 0.78, 1.15);
    }
  }

  /* ============================================================
     更新（毎フレーム）
     ============================================================ */
  function update(dt) {
    var g = game, stage = g.stage, ship = g.ship;
    if (!g.playing || g.paused) return;

    var mag = stickVec.mag;
    if (mag > 0) {
      var speed = lerp(MIN_SPEED, MAX_SPEED, mag);
      var dx = stickVec.x * speed * dt, dy = stickVec.y * speed * dt;
      moveWithSliding(g, dx, dy);
      var targetAngle = Math.atan2(stickVec.y, stickVec.x) * 180 / Math.PI;
      var diff = ((targetAngle - ship.angle + 540) % 360) - 180;
      var factor = 1 - Math.exp(-dt / ANGLE_TAU);
      ship.angle += diff * factor;
      ship.displayAngle = ship.angle;
    }

    // ゴール判定（ゴール専用の当たり判定エリア。十分に侵入した時点でクリア）
    var gd = Math.hypot(ship.x - stage.goalPosition.x, ship.y - stage.goalPosition.y);
    if (gd <= stage.goalRadius - stage.shipSize * 0.3) {
      onGoalReached();
      return;
    }

    updateCameraFollow(dt);
    g.bubbles.forEach(function (b) {
      b.y -= b.speed * dt;
      b.x += Math.sin(b.phase + performance.now() / 900) * b.drift * dt;
      if (b.y < -8) { b.y = stage.mazeBounds.height + 8; b.x = Math.random() * stage.mazeBounds.width; }
    });
  }

  // 壁ずり(Wall Sliding)。海底洞窟の通路は斜め・カーブが多いため、
  // 上下左右2方向だけを試す方式だと、その2方向のどちらでもない角度で
  // 壁に当たったときに完全に止まってしまう(操作していて「つっかえる」感触)。
  // 実際の壁の法線方向を求め、その接線方向へ滑らせることで、どの角度で
  // 壁に当たってもスッと沿って進めるようにする。
  //
  // 法線は「動こうとした先(ぶつかった点)」で取る。動く前の船の位置はまだ
  // 通路の余裕がある場所なので、そこを基準に法線を求めると、カーブの先で
  // 実際に当たっている壁と違う向きを拾ってしまい、浅い角度でも止まって
  // しまうことがあった。ぶつかった点そのもので法線を取り、滑らせた後も
  // まだ塞がれていれば、その滑り先でもう一度だけ同じ処理をやり直す
  // (角に挟まれたときの保険)。
  //
  // 壁へ向かう成分をただ差し引くだけ(射影)だと、壁に正面から近いほど
  // 沿う方向の成分そのものが小さくなり、進む速さがどんどん落ちて
  // 「浅い角度でしか滑らかに進めない」ように感じられる。ここでは向きだけを
  // 壁沿いに直し、速さ(入力の大きさ)は保つ。1フレームあたりの移動量は
  // もともと小さいので、向きを合わせ直しても壁をすり抜ける心配はない。
  function moveWithSliding(g, dx, dy, depth) {
    var ship = g.ship, index = g.index, shipR = g.stage.shipSize;
    var nx = ship.x + dx, ny = ship.y + dy;
    if (isPassable(index, shipR, nx, ny)) { ship.x = nx; ship.y = ny; return; }
    if ((depth || 0) >= 4) return;

    var wall = nearestWallNormal(index, shipR, nx, ny);
    if (wall) {
      // wall.nx/ny は通路の中心線から見て外向き(壁の側)。この向きへさらに
      // 進もうとしている(内積が正)場合だけ、その成分を取り除いて滑らせる。
      var dot = dx * wall.nx + dy * wall.ny;
      if (dot > 0) {
        var slideX = dx - dot * wall.nx, slideY = dy - dot * wall.ny;
        var slideLen = Math.hypot(slideX, slideY);
        if (slideLen > 0.001) {
          var inputMag = Math.hypot(dx, dy);
          var scale = inputMag / slideLen;
          moveWithSliding(g, slideX * scale, slideY * scale, (depth || 0) + 1);
          return;
        }
      }
    }
    // 保険: 角に挟まれた場合など、上下左右のどちらかだけなら通れることがある
    if (dx !== 0 && isPassable(index, shipR, nx, ship.y)) { ship.x = nx; return; }
    if (dy !== 0 && isPassable(index, shipR, ship.x, ny)) { ship.y = ny; return; }
  }

  function updateCameraFollow(dt) {
    var g = game, cam = g.camera, stage = g.stage;
    if (cam.mode !== 'follow') return;
    var mw = stage.mazeBounds.width, mh = stage.mazeBounds.height;
    var viewW = cssW / cam.scale, viewH = cssH / cam.scale;
    var targetX = viewW >= mw ? mw / 2 : clamp(g.ship.x, viewW / 2, mw - viewW / 2);
    var targetY = viewH >= mh ? mh / 2 : clamp(g.ship.y, viewH / 2, mh - viewH / 2);
    var factor = 1 - Math.exp(-dt / CAMERA_TAU);
    cam.cx = lerp(cam.cx, targetX, factor);
    cam.cy = lerp(cam.cy, targetY, factor);
  }

  function onGoalReached() {
    var g = game;
    g.playing = false;
    resetStick();
    var firstClear = markCleared(g.stageId);
    setTimeout(function () {
      $('dsm-clear-title').textContent = 'Stage ' + g.stageId;
      $('dsm-clear-next').textContent = g.stageId >= TOTAL_STAGES ? '全ステージ制覇！' : '次のステージへ';
      openModal('modal-dsm-clear');
    }, firstClear ? 420 : 320);
  }

  /* ============================================================
     描画
     ============================================================ */
  var THEME_COLORS = {
    1: { top: '#1d5b7a', bottom: '#0b2d42', rock: '#123a4d', rockDark: '#0a2432', water: '#2f8fae', waterEdge: '#0d4257' },
    2: { top: '#166a72', bottom: '#082e33', rock: '#0f3f42', rockDark: '#082629', water: '#2fa79a', waterEdge: '#0c4a44' },
    3: { top: '#123a5e', bottom: '#050f22', rock: '#101f3a', rockDark: '#080f1e', water: '#3a6fae', waterEdge: '#0c2c52' },
    4: { top: '#1a2f5e', bottom: '#050a1c', rock: '#141c3c', rockDark: '#080b1e', water: '#4a5fc2', waterEdge: '#161f52' },
    5: { top: '#2a1f4e', bottom: '#0a0618', rock: '#241a3c', rockDark: '#0e0a1e', water: '#6a5cc2', waterEdge: '#241a52' },
    6: { top: '#3a1a3a', bottom: '#0e0412', rock: '#2c1430', rockDark: '#120616', water: '#a24ec2', waterEdge: '#3a1452' }
  };

  function render() {
    var g = game;
    if (!g || cssW <= 0 || cssH <= 0) return;
    var stage = g.stage, cam = g.camera;
    var theme = THEME_COLORS[bandOf(g.stageId)] || THEME_COLORS[1];

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, theme.top);
    bg.addColorStop(1, theme.bottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.cx, -cam.cy);

    // 海底の岩盤(迷路全体)
    var rockGrad = ctx.createLinearGradient(0, 0, 0, stage.mazeBounds.height);
    rockGrad.addColorStop(0, theme.rock);
    rockGrad.addColorStop(1, theme.rockDark);
    ctx.fillStyle = rockGrad;
    ctx.fillRect(0, 0, stage.mazeBounds.width, stage.mazeBounds.height);

    drawDecorations(stage, theme, 'back');
    drawCorridors(stage, theme);
    drawDecorations(stage, theme, 'front');
    drawBubbles(g.bubbles, theme);
    drawStartMarker(stage);
    drawGoalMarker(stage);
    drawShip(g.ship, stage);
    if (DEBUG) drawDebugWorld(g);

    ctx.restore();
    if (DEBUG) drawDebugScreen(g);
  }

  function pathFor(seg) {
    ctx.beginPath();
    ctx.moveTo(seg.points[0][0], seg.points[0][1]);
    for (var i = 1; i < seg.points.length; i++) ctx.lineTo(seg.points[i][0], seg.points[i][1]);
  }

  function drawCorridors(stage, theme) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    stage.segments.forEach(function (seg) {
      pathFor(seg);
      ctx.strokeStyle = theme.waterEdge;
      ctx.lineWidth = seg.width + 10;
      ctx.stroke();
    });
    stage.segments.forEach(function (seg) {
      pathFor(seg);
      ctx.strokeStyle = theme.water;
      ctx.lineWidth = seg.width;
      ctx.globalAlpha = 0.92;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    stage.segments.forEach(function (seg) {
      pathFor(seg);
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = Math.max(2, seg.width * 0.22);
      ctx.stroke();
    });
  }

  function drawDecorations(stage, theme, layer) {
    (stage.decorations || []).forEach(function (d, i) {
      var back = (i % 2 === 0);
      if ((layer === 'back') !== back) return;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot * Math.PI / 180);
      ctx.scale(d.scale, d.scale);
      if (d.type === 'rock') {
        ctx.fillStyle = theme.rockDark;
        ctx.beginPath();
        ctx.moveTo(-11, 6); ctx.lineTo(-5, -9); ctx.lineTo(4, -11); ctx.lineTo(11, -1); ctx.lineTo(7, 8); ctx.lineTo(-4, 10);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === 'plant') {
        ctx.strokeStyle = 'rgba(80,200,160,.55)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        for (var k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(k * 4, 6);
          ctx.quadraticCurveTo(k * 10, -6, k * 3, -16);
          ctx.stroke();
        }
      } else {
        var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
        glow.addColorStop(0, 'rgba(160,255,240,.85)');
        glow.addColorStop(1, 'rgba(160,255,240,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawBubbles(bubbles, theme) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    bubbles.forEach(function (b) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStartMarker(stage) {
    var p = stage.startPosition;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, stage.shipSize + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, stage.shipSize + 18, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawGoalMarker(stage) {
    var p = stage.goalPosition;
    var t = performance.now() / 500;
    var pulse = 0.5 + 0.5 * Math.sin(t);
    ctx.save();
    ctx.translate(p.x, p.y);
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, stage.goalRadius * 1.6);
    glow.addColorStop(0, 'rgba(140,255,255,' + (0.55 + pulse * 0.25) + ')');
    glow.addColorStop(1, 'rgba(140,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, stage.goalRadius * 1.6, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#e8fffd';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, stage.goalRadius * (0.72 + pulse * 0.12), 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#e8fffd';
    ctx.font = 'bold ' + Math.max(11, Math.round(stage.goalRadius * 0.42)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 6;
    ctx.fillText('GOAL', 0, 1);
    ctx.restore();
  }

  function drawShip(ship, stage) {
    var r = stage.shipSize * 1.3;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.displayAngle * Math.PI / 180);

    // 前方ライト
    var light = ctx.createRadialGradient(r * 0.9, 0, 0, r * 0.9, 0, r * 3.2);
    light.addColorStop(0, 'rgba(255,255,220,.55)');
    light.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(r * 0.6, 0);
    ctx.lineTo(r * 3.4, -r * 1.7);
    ctx.lineTo(r * 3.4, r * 1.7);
    ctx.closePath();
    ctx.fill();

    // 船体(丸みのあるカプセル)
    var hull = ctx.createLinearGradient(0, -r, 0, r);
    hull.addColorStop(0, '#eef3f6');
    hull.addColorStop(0.55, '#c3d2da');
    hull.addColorStop(1, '#8ea3ad');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.35, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,45,.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // ドーム窓
    ctx.fillStyle = 'rgba(60,150,190,.85)';
    ctx.beginPath();
    ctx.ellipse(r * 0.28, -r * 0.08, r * 0.42, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 小型スクリュー(船尾)
    ctx.fillStyle = '#6b7d86';
    ctx.beginPath();
    ctx.ellipse(-r * 1.25, 0, r * 0.24, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDebugWorld(g) {
    var stage = g.stage;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,80,.85)';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    stage.segments.forEach(function (seg) {
      pathFor(seg);
      ctx.lineWidth = Math.max(1, seg.width - g.stage.shipSize * 2);
      ctx.stroke();
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(g.ship.x, g.ship.y, stage.shipSize, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#4dffb0';
    ctx.beginPath(); ctx.arc(stage.goalPosition.x, stage.goalPosition.y, stage.goalRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText('START ' + Math.round(stage.startPosition.x) + ',' + Math.round(stage.startPosition.y), stage.startPosition.x + 14, stage.startPosition.y);
    ctx.restore();
  }
  function drawDebugScreen(g) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(6, 6, 190, 78);
    ctx.fillStyle = '#9dffb0';
    ctx.font = '11px monospace';
    ctx.fillText('FPS ' + fps.toFixed(0), 14, 22);
    ctx.fillText('ship ' + g.ship.x.toFixed(0) + ',' + g.ship.y.toFixed(0), 14, 38);
    ctx.fillText('cam ' + g.camera.cx.toFixed(0) + ',' + g.camera.cy.toFixed(0) + ' (' + g.camera.mode + ')', 14, 54);
    ctx.fillText('scale ' + g.camera.scale.toFixed(2) + ' stage ' + g.stageId, 14, 70);
    ctx.restore();
  }

  /* ============================================================
     ゲームループ
     ============================================================ */
  function loop(now) {
    if (!game) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
    if (dt > 0) fps = lerp(fps, 1 / Math.max(dt, 1 / 240), 0.1);
    lastFrameTime = now;
    update(dt);
    render();
    game.rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (game && game.rafId) cancelAnimationFrame(game.rafId);
    if (game) game.playing = false;
  }

  /* ---------- ボタン ---------- */
  $('dsm-back').addEventListener('click', openSelect);
  $('dsm-restart').addEventListener('click', function () {
    if (anyDsmModalOpen()) return;
    resetCurrentStage();
  });
  $('dsm-pause-btn').addEventListener('click', function () {
    if (!game) return;
    game.paused = true;
    resetStick();
    openModal('modal-dsm-pause');
  });
  $('dsm-pause-resume').addEventListener('click', function () {
    closeModal('modal-dsm-pause');
    if (game) game.paused = false;
  });
  $('dsm-pause-restart').addEventListener('click', function () {
    closeModal('modal-dsm-pause');
    resetCurrentStage();
  });
  $('dsm-pause-select').addEventListener('click', function () {
    closeModal('modal-dsm-pause');
    openSelect();
  });

  $('dsm-clear-next').addEventListener('click', function () {
    closeModal('modal-dsm-clear');
    if (!game) return;
    var next = game.stageId + 1;
    if (next <= TOTAL_STAGES) openGame(next); else openSelect();
  });
  $('dsm-clear-retry').addEventListener('click', function () {
    closeModal('modal-dsm-clear');
    resetCurrentStage();
  });
  $('dsm-clear-select').addEventListener('click', function () {
    closeModal('modal-dsm-clear');
    openSelect();
  });

  // 何かの拍子(ブラウザBack・複数タッチ等)でポインタが浮いたままにならないよう、
  // 画面全体でのpointercancel/離脱もスティックの解除に含める
  window.addEventListener('blur', function () { if (stickPointerId !== null) resetStick(); if (game) game.paused = true; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (stickPointerId !== null) resetStick(); if (game) game.paused = true; }
  });

  window.DeepSeaMaze = { openSelect: openSelect };

  // 開発用デバッグモード(本番では ?dsmdebug=1 を付けない限り無効)。
  // FPS/当たり判定/座標のオーバーレイ表示に加え、ステージ調整・自動テスト用に
  // 現在のゲーム状態を読み書きするフックをここでだけ公開する。
  if (DEBUG) {
    window.DeepSeaMaze.debug = {
      getGame: function () { return game; },
      warpTo: function (x, y) { if (game) { game.ship.x = x; game.ship.y = y; } },
      // 壁ずり(moveWithSliding)の当たり判定を、実際のジョイスティック操作を
      // 介さず直接テストするためのフック(自動テスト・調整用)。
      simulateMove: function (dx, dy) { if (game) moveWithSliding(game, dx, dy); },
      isPassable: function (x, y) { return game ? isPassable(game.index, game.stage.shipSize, x, y) : null; }
    };
  }
})();
