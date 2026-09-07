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

  // セルが小さいと3段の千鳥格子は潰れて見えるため、簡略な2段柄に切り替える
  // しきい値。盤面のセルはこれより常に大きいので通常は3段のまま。
  var COMPACT_BRICK_THRESHOLD = 22;
  function brickClass(size, extraClasses) {
    var cls = 'bf-brick';
    if (size < COMPACT_BRICK_THRESHOLD) cls += ' is-compact';
    if (extraClasses) cls += ' ' + extraClasses;
    return cls;
  }

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
  // game = { stageId, stage, boardCellSet, placements, selectedId, rotations,
  //          cellSize, draggingId, draggingRotation, hoverOrigin, hoverValid }
  // placements: { pieceId: { origin: {x,y}, rotation } } — 盤面に置いたブロック。
  // rotations: { pieceId: 0-3 } — まだ置き場にあるブロックの回転（置いたら
  //   placements 側の rotation に一本化される）。
  var game = null;

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

  function pieceById(pieceId) {
    return game.stage.pieces.filter(function (p) { return p.id === pieceId; })[0];
  }

  function rotationOf(pieceId) {
    var placed = game.placements[pieceId];
    return placed ? placed.rotation : (game.rotations[pieceId] || 0);
  }

  /* ---------- 配置ルール（枠外判定・重複判定） ---------- */
  function cellsFor(pieceId, origin, rotation) {
    var piece = pieceById(pieceId);
    return rotateCells(piece.cells, rotation).map(function (c) {
      return { x: c.x + origin.x, y: c.y + origin.y };
    });
  }

  function fits(pieceId, origin, rotation) {
    var cells = cellsFor(pieceId, origin, rotation);
    for (var i = 0; i < cells.length; i++) {
      if (!game.boardCellSet[cells[i].x + ',' + cells[i].y]) return false;
    }
    var otherIds = Object.keys(game.placements).filter(function (id) { return id !== pieceId; });
    for (var j = 0; j < otherIds.length; j++) {
      var other = game.placements[otherIds[j]];
      var otherSet = {};
      cellsFor(otherIds[j], other.origin, other.rotation).forEach(function (c) {
        otherSet[c.x + ',' + c.y] = true;
      });
      for (var k = 0; k < cells.length; k++) {
        if (otherSet[cells[k].x + ',' + cells[k].y]) return false;
      }
    }
    return true;
  }

  function canPlace(pieceId, origin, rotation) { return fits(pieceId, origin, rotation); }

  function openGame(stageId) {
    var stage = previewStage();
    var boardCellSet = {};
    stage.boardCells.forEach(function (c) { boardCellSet[c.x + ',' + c.y] = true; });
    game = {
      stageId: stageId, stage: stage, boardCellSet: boardCellSet,
      placements: {}, selectedId: null, rotations: {}, cellSize: 48,
      draggingId: null, draggingRotation: 0, hoverOrigin: null, hoverValid: false
    };
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
    for (var y = 0; y < stage.height; y++) {
      for (var x = 0; x < stage.width; x++) {
        if (!game.boardCellSet[x + ',' + y]) continue;
        var c = el('div', 'bf-cell');
        c.style.left = (x * size + 1.5) + 'px';
        c.style.top = (y * size + 1.5) + 'px';
        c.style.width = (size - 3) + 'px';
        c.style.height = (size - 3) + 'px';
        boardEl.appendChild(c);
      }
    }
    Object.keys(game.placements).forEach(function (pieceId) {
      var placement = game.placements[pieceId];
      var piece = pieceById(pieceId);
      var selected = game.selectedId === pieceId;
      rotateCells(piece.cells, placement.rotation).forEach(function (c) {
        var b = el('div', brickClass(size, selected ? 'is-selected' : ''));
        b.style.setProperty('--bf-piece', piece.color);
        b.style.left = ((placement.origin.x + c.x) * size + 1.5) + 'px';
        b.style.top = ((placement.origin.y + c.y) * size + 1.5) + 'px';
        b.style.width = (size - 3) + 'px';
        b.style.height = (size - 3) + 'px';
        attachDragHandlers(b, pieceId);
        if (pieceId === game.draggingId) b.classList.add('is-dragging-source');
        boardEl.appendChild(b);
      });
    });
    var overlay = el('div');
    overlay.id = 'bf-hover-preview';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    boardEl.appendChild(overlay);
    renderHoverPreview();
  }

  function renderHoverPreview() {
    if (!game) return;
    var overlay = $('bf-hover-preview');
    if (!overlay) return;
    overlay.innerHTML = '';
    if (!game.draggingId || !game.hoverOrigin) return;
    var piece = pieceById(game.draggingId);
    var size = game.cellSize;
    rotateCells(piece.cells, game.draggingRotation).forEach(function (c) {
      var cell = el('div', brickClass(size, game.hoverValid ? 'is-preview-ok' : 'is-preview-bad'));
      cell.style.left = ((game.hoverOrigin.x + c.x) * size + 1.5) + 'px';
      cell.style.top = ((game.hoverOrigin.y + c.y) * size + 1.5) + 'px';
      cell.style.width = (size - 3) + 'px';
      cell.style.height = (size - 3) + 'px';
      overlay.appendChild(cell);
    });
  }

  function buildPieceElement(piece, rotationSteps, cellSize, selected) {
    var cells = rotateCells(piece.cells, rotationSteps);
    var w = boundsW(cells) * cellSize, h = boundsH(cells) * cellSize;
    var wrap = el('div', 'bf-tray-piece');
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    cells.forEach(function (c) {
      var b = el('div', brickClass(cellSize, selected ? 'is-selected' : ''));
      b.style.setProperty('--bf-piece', piece.color);
      b.style.left = (c.x * cellSize) + 'px';
      b.style.top = (c.y * cellSize) + 'px';
      b.style.width = cellSize + 'px';
      b.style.height = cellSize + 'px';
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderTray() {
    if (!game) return;
    var tray = $('bf-tray');
    tray.innerHTML = '';
    game.stage.pieces.forEach(function (piece) {
      if (game.placements[piece.id]) return; // 置いたブロックは置き場から消える
      var selected = game.selectedId === piece.id;
      var rotation = game.rotations[piece.id] || 0;
      var wrap = buildPieceElement(piece, rotation, selected ? 26 : 15, selected);
      attachDragHandlers(wrap, piece.id);
      if (piece.id === game.draggingId) wrap.classList.add('is-dragging-source');
      tray.appendChild(wrap);
    });
  }

  function onPieceTap(pieceId) {
    game.selectedId = (game.selectedId === pieceId) ? null : pieceId;
    renderBoard();
    renderTray();
    updateRotateButton();
  }

  function updateRotateButton() {
    $('bf-rotate').disabled = !game || !game.selectedId;
  }

  $('bf-rotate').addEventListener('click', function () {
    if (!game || !game.selectedId) return;
    var id = game.selectedId;
    var placement = game.placements[id];
    if (placement) {
      var newRotation = (placement.rotation + 1) % 4;
      if (fits(id, placement.origin, newRotation)) {
        placement.rotation = newRotation;
        renderBoard();
      }
    } else {
      game.rotations[id] = ((game.rotations[id] || 0) + 1) % 4;
      renderTray();
    }
  });

  /* ---------- ドラッグ操作 ----------
     タップとドラッグは同じ pointerdown から始まる。指が閾値以上動いたら
     初めてドラッグとみなし、ブロックを指より少し上に浮かせて追従させる。
     動かなければ従来どおりタップ（選択/解除）として扱う。 */
  var DRAG_THRESHOLD = 6;

  function attachDragHandlers(elx, pieceId) {
    elx.dataset.pieceId = pieceId;
    elx.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ev.preventDefault();
      startTracking(pieceId, ev, elx);
    });
  }

  function startTracking(pieceId, downEv, sourceEl) {
    var x0 = downEv.clientX, y0 = downEv.clientY, moved = false;
    try { sourceEl.setPointerCapture(downEv.pointerId); } catch (e) { /* 対応外環境は通常のイベントで続行 */ }

    function onMove(ev) {
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        moved = true;
        beginDrag(pieceId);
      }
      if (moved) updateGhost(pieceId, ev.clientX, ev.clientY);
    }
    function onUp() {
      sourceEl.removeEventListener('pointermove', onMove);
      sourceEl.removeEventListener('pointerup', onUp);
      sourceEl.removeEventListener('pointercancel', onUp);
      if (moved) endDrag(pieceId); else onPieceTap(pieceId);
    }
    sourceEl.addEventListener('pointermove', onMove);
    sourceEl.addEventListener('pointerup', onUp);
    sourceEl.addEventListener('pointercancel', onUp);
  }

  function beginDrag(pieceId) {
    game.selectedId = pieceId;
    game.draggingId = pieceId;
    game.draggingRotation = rotationOf(pieceId);
    // その場でDOMを作り直さず、既存の要素をクラスで隠すだけにする
    // （作り直すと、いま pointer capture を持っている要素ごと消えてしまう）。
    document.querySelectorAll('[data-piece-id="' + pieceId + '"]').forEach(function (elx) {
      elx.classList.add('is-dragging-source');
    });
    updateRotateButton();
    showGhost(pieceId);
  }

  function showGhost(pieceId) {
    var piece = pieceById(pieceId);
    var cells = rotateCells(piece.cells, game.draggingRotation);
    var size = game.cellSize;
    var ghost = $('bf-drag-ghost');
    ghost.innerHTML = '';
    ghost.style.width = (boundsW(cells) * size) + 'px';
    ghost.style.height = (boundsH(cells) * size) + 'px';
    cells.forEach(function (c) {
      var b = el('div', brickClass(size, 'is-selected is-ghost'));
      b.style.setProperty('--bf-piece', piece.color);
      b.style.left = (c.x * size) + 'px';
      b.style.top = (c.y * size) + 'px';
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      ghost.appendChild(b);
    });
    ghost.hidden = false;
  }

  function updateGhost(pieceId, clientX, clientY) {
    var piece = pieceById(pieceId);
    var size = game.cellSize;
    var cells = rotateCells(piece.cells, game.draggingRotation);
    var w = boundsW(cells) * size, h = boundsH(cells) * size;
    // 指の真上あたりにブロックの中心が来るよう左右は中央合わせ、
    // 指で隠れないよう縦方向はさらに上へ持ち上げる。
    var ghostLeft = clientX - w / 2;
    var ghostTop = clientY - h / 2 - size * 1.4;
    var ghost = $('bf-drag-ghost');
    ghost.style.left = ghostLeft + 'px';
    ghost.style.top = ghostTop + 'px';

    var frameRect = $('bf-board-frame').getBoundingClientRect();
    var margin = size;
    var nearBoard = clientX > frameRect.left - margin && clientX < frameRect.right + margin &&
                    clientY > frameRect.top - margin && clientY < frameRect.bottom + margin;
    if (nearBoard) {
      var boardRect = $('bf-board').getBoundingClientRect();
      var origin = {
        x: Math.round((ghostLeft - boardRect.left) / size),
        y: Math.round((ghostTop - boardRect.top) / size)
      };
      game.hoverOrigin = origin;
      game.hoverValid = canPlace(pieceId, origin, game.draggingRotation);
    } else {
      game.hoverOrigin = null;
      game.hoverValid = false;
    }
    renderHoverPreview();
  }

  function hideGhost() {
    var ghost = $('bf-drag-ghost');
    ghost.hidden = true;
    ghost.innerHTML = '';
  }

  function endDrag(pieceId) {
    var origin = game.hoverOrigin, valid = game.hoverValid, rotation = game.draggingRotation;
    if (origin && valid) {
      game.placements[pieceId] = { origin: origin, rotation: rotation };
      delete game.rotations[pieceId];
    }
    game.draggingId = null;
    game.hoverOrigin = null;
    game.hoverValid = false;
    hideGhost();
    renderBoard();
    renderTray();
    updateRotateButton();
  }

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
    game.placements = {};
    renderBoard();
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
