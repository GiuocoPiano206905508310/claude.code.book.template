/* ============================================================
   ブロックフィットパズル — Phase 1 (画面プレビュー)
   ステージ選択画面とゲーム画面の見た目・タップでの選択/回転までを実装。
   ドラッグでの配置・当たり判定・クリア判定は次のフェーズで追加する
   （Flutter 版の Phase 1 と同じ段階）。
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  var TOTAL_STAGES = 50;
  function bandOf(stageId) { return Math.min(5, Math.floor((stageId - 1) / 10) + 1); }

  var PIECE_COLORS = ['#4c9b7c', '#5fa8d3', '#e0b24a', '#e08a5b', '#8c6fb0', '#d97a97'];

  /* ---------- 回転（座標変換。回転ごとの別画像は使わない） ---------- */
  function rotateCells(cells, times) {
    var t = ((times % 4) + 4) % 4;
    var pts = cells;
    for (var i = 0; i < t; i++) {
      pts = pts.map(function (p) { return { x: -p.y, y: p.x }; });
    }
    var minX = Math.min.apply(null, pts.map(function (p) { return p.x; }));
    var minY = Math.min.apply(null, pts.map(function (p) { return p.y; }));
    return pts.map(function (p) { return { x: p.x - minX, y: p.y - minY }; });
  }
  function boundsW(cells) { return Math.max.apply(null, cells.map(function (p) { return p.x; })) + 1; }
  function boundsH(cells) { return Math.max.apply(null, cells.map(function (p) { return p.y; })) + 1; }

  /* ---------- ダミーステージ（Stage 1 のプレビュー用データ） ---------- */
  function previewStage() {
    function row(y, fromX, toX) {
      var out = [];
      for (var x = fromX; x <= toX; x++) out.push({ x: x, y: y });
      return out;
    }
    var boardCells = [].concat(
      row(0, 0, 3), row(1, 0, 4), row(2, 1, 5), row(3, 1, 5), row(4, 0, 4), row(5, 0, 3)
    );
    var pieces = [
      { id: 'A', color: PIECE_COLORS[0], cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
      { id: 'B', color: PIECE_COLORS[1], cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] },
      { id: 'C', color: PIECE_COLORS[2], cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'D', color: PIECE_COLORS[3], cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
      { id: 'E', color: PIECE_COLORS[4], cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }] }
    ];
    return { width: 6, height: 6, boardCells: boardCells, pieces: pieces };
  }

  /* ---------- 進行状況（仮。セーブは次のフェーズ） ---------- */
  var cleared = { 1: true, 2: true, 3: true };
  var debugMode = false;
  function highestUnlocked() {
    if (debugMode) return TOTAL_STAGES;
    var maxCleared = 0;
    Object.keys(cleared).forEach(function (k) { maxCleared = Math.max(maxCleared, +k); });
    return Math.min(TOTAL_STAGES, maxCleared + 1);
  }
  function isUnlocked(id) { return debugMode || id <= highestUnlocked(); }

  /* ---------- ステージ選択画面 ---------- */
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
      btn.classList.add('is-cleared', 'bf-band-' + bandOf(id));
      btn.setAttribute('aria-label', 'Stage ' + id);
      if (cleared[id]) {
        var star = el('span', 'stage-stars');
        star.innerHTML = '<svg class="ic star"><use href="#ic-star"/></svg>';
        btn.appendChild(star);
      } else if (id === highestUnlocked()) {
        btn.classList.add('is-next');
      }
      btn.addEventListener('click', function () { openGame(id); });
    }
    li.appendChild(btn);
    return li;
  }

  function fillGrid() {
    var grid = $('bf-stage-grid');
    grid.innerHTML = '';
    for (var i = 1; i <= TOTAL_STAGES; i++) grid.appendChild(stageButton(i));
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('is-active'); });
    $(id).classList.add('is-active');
  }

  function openSelect() {
    var done = Object.keys(cleared).length;
    $('bf-select-progress').textContent = 'クリア ' + done + ' / ' + TOTAL_STAGES;
    $('bf-debug-toggle').checked = debugMode;
    fillGrid();
    showScreen('screen-bf-select');
  }

  $('bf-select-back').addEventListener('click', function () { window.openGameSelect(); });
  $('bf-debug-toggle').addEventListener('change', function (ev) {
    debugMode = ev.target.checked;
    fillGrid();
  });

  /* ---------- ゲーム画面 ---------- */
  var game = null; // { stageId, stage, selectedId, rotations, cellSize }

  function setTheme(stageId) {
    // body にも同じ帯クラスを付ける。中断/遊び方/設定モーダルは画面の
    // 外側（兄弟要素）にあるため、#screen-bf-game だけに付けても
    // --bf-accent 等を継承できない。
    var band = 'bf-theme-' + bandOf(stageId);
    [$('screen-bf-game'), document.body].forEach(function (target) {
      for (var i = 1; i <= 5; i++) target.classList.remove('bf-theme-' + i);
      target.classList.add(band);
    });
  }

  function openGame(stageId) {
    game = { stageId: stageId, stage: previewStage(), selectedId: null, rotations: {}, cellSize: 48 };
    setTheme(stageId);
    $('bf-stage-label').textContent = 'Stage ' + stageId;
    renderTray();
    updateRotateButton();
    showScreen('screen-bf-game');
    fitBoard();
    requestAnimationFrame(fitBoard);
  }

  function fitBoard() {
    if (!game || !$('screen-bf-game').classList.contains('is-active')) return;
    var area = document.querySelector('#screen-bf-game .bf-board-area');
    var stage = game.stage;
    var availW = area.clientWidth - 24;
    var availH = area.clientHeight - 24;
    if (availW <= 0 || availH <= 0) return;
    var size = Math.floor(Math.min(availW / stage.width, availH / stage.height));
    size = Math.max(24, Math.min(64, size));
    game.cellSize = size;
    renderBoard();
  }

  function renderBoard() {
    if (!game) return;
    var stage = game.stage;
    var size = game.cellSize;
    var boardEl = $('bf-board');
    boardEl.style.width = (size * stage.width) + 'px';
    boardEl.style.height = (size * stage.height) + 'px';
    boardEl.innerHTML = '';
    var set = {};
    stage.boardCells.forEach(function (c) { set[c.x + ',' + c.y] = true; });
    for (var y = 0; y < stage.height; y++) {
      for (var x = 0; x < stage.width; x++) {
        if (!set[x + ',' + y]) continue;
        var c = el('div', 'bf-cell');
        c.style.left = (x * size + 1.5) + 'px';
        c.style.top = (y * size + 1.5) + 'px';
        c.style.width = (size - 3) + 'px';
        c.style.height = (size - 3) + 'px';
        boardEl.appendChild(c);
      }
    }
  }

  function renderPieceInto(container, piece, rotationSteps, cellSize, selected) {
    var cells = rotateCells(piece.cells, rotationSteps);
    var w = boundsW(cells) * cellSize, h = boundsH(cells) * cellSize;
    var wrap = el('div', 'bf-tray-piece');
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    cells.forEach(function (c) {
      var b = el('div', 'bf-brick' + (selected ? ' is-selected' : ''));
      b.style.setProperty('--bf-piece', piece.color);
      b.style.left = (c.x * cellSize) + 'px';
      b.style.top = (c.y * cellSize) + 'px';
      b.style.width = cellSize + 'px';
      b.style.height = cellSize + 'px';
      wrap.appendChild(b);
    });
    wrap.addEventListener('click', function () { onPieceTap(piece.id); });
    container.appendChild(wrap);
  }

  function renderTray() {
    if (!game) return;
    var tray = $('bf-tray');
    tray.innerHTML = '';
    game.stage.pieces.forEach(function (piece) {
      var selected = game.selectedId === piece.id;
      var rotation = game.rotations[piece.id] || 0;
      renderPieceInto(tray, piece, rotation, selected ? 26 : 15, selected);
    });
  }

  function onPieceTap(pieceId) {
    game.selectedId = (game.selectedId === pieceId) ? null : pieceId;
    renderTray();
    updateRotateButton();
  }

  function updateRotateButton() {
    $('bf-rotate').disabled = !game || !game.selectedId;
  }

  $('bf-rotate').addEventListener('click', function () {
    if (!game || !game.selectedId) return;
    var id = game.selectedId;
    game.rotations[id] = ((game.rotations[id] || 0) + 1) % 4;
    renderTray();
  });

  $('bf-home').addEventListener('click', function () { window.openGameSelect(); });

  $('bf-help').addEventListener('click', function () { $('modal-bf-help').hidden = false; });
  $('bf-help-close').addEventListener('click', function () { $('modal-bf-help').hidden = true; });

  $('bf-hint').addEventListener('click', function () { $('modal-bf-hint').hidden = false; });
  $('bf-hint-close').addEventListener('click', function () { $('modal-bf-hint').hidden = true; });

  $('bf-pause').addEventListener('click', function () { $('modal-bf-pause').hidden = false; });
  $('bf-pause-resume').addEventListener('click', function () { $('modal-bf-pause').hidden = true; });
  $('bf-pause-restart').addEventListener('click', function () {
    $('modal-bf-pause').hidden = true;
    if (!game) return;
    game.selectedId = null;
    game.rotations = {};
    renderTray();
    updateRotateButton();
  });
  $('bf-pause-select').addEventListener('click', function () {
    $('modal-bf-pause').hidden = true;
    openSelect();
  });

  /* ---------- 設定（背景ダーク/ホワイト） ---------- */
  var BG_KEY = 'blockFitPuzzle.background.v1';
  function applyBackground(mode) {
    document.body.classList.toggle('bf-dark', mode === 'dark');
    $('bf-bg-white').classList.toggle('is-on', mode !== 'dark');
    $('bf-bg-dark').classList.toggle('is-on', mode === 'dark');
    try { window.localStorage.setItem(BG_KEY, mode); } catch (e) { /* 保存できなくても遊べる */ }
    if ($('screen-bf-select').classList.contains('is-active')) fillGrid();
  }
  $('bf-settings').addEventListener('click', function () { $('modal-bf-settings').hidden = false; });
  $('bf-settings-close').addEventListener('click', function () { $('modal-bf-settings').hidden = true; });
  $('bf-bg-white').addEventListener('click', function () { applyBackground('light'); });
  $('bf-bg-dark').addEventListener('click', function () { applyBackground('dark'); });

  (function initBackground() {
    var saved = null;
    try { saved = window.localStorage.getItem(BG_KEY); } catch (e) { /* 既定値で始める */ }
    applyBackground(saved === 'dark' ? 'dark' : 'light');
  })();

  window.addEventListener('resize', fitBoard);

  window.BlockFitPuzzle = { openSelect: openSelect };
})();
