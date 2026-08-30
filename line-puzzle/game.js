/* ============================================================
   ラインパズル — まっすぐ進んで全マスを塗りつぶすパズル
   ・壁・盤面の端・すでに通ったマス に当たるまで直進する
   ・すべてのマスを塗ればクリア（同じマスは二度通れない）
   ・全50ステージ / ユーザー名登録 / クリア時オートセーブ
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 定数 ---------- */
  var DIRS = [
    { ch: 'U', dx: 0, dy: -1 },
    { ch: 'D', dx: 0, dy: 1 },
    { ch: 'L', dx: -1, dy: 0 },
    { ch: 'R', dx: 1, dy: 0 }
  ];
  var DCH = 'UDLR';
  var STORE_KEY = 'linePuzzle.save.v1';
  var SOLVE_BUDGET = 400000;   // ソルバーが辿るノード数の上限

  var LEVELS = window.LEVELS || [];

  /* ---------- DOM ヘルパ ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  /* ============================================================
     1. セーブデータ
     ============================================================ */
  var memoryStore = null;      // localStorage が使えない環境の代替
  var storageWarned = false;

  function readStore() {
    if (memoryStore) return memoryStore;
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== 'object') data = {};
      if (!data.users || typeof data.users !== 'object') data.users = {};
      return data;
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        toast('この環境では保存できません（セッション内のみ保持します）');
      }
      memoryStore = { users: {}, current: null };
      return memoryStore;
    }
  }

  function writeStore(data) {
    if (memoryStore) { memoryStore = data; return; }
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        toast('保存に失敗しました（セッション内のみ保持します）');
      }
      memoryStore = data;
    }
  }

  /* ============================================================
     2. ユーザー名の正規化・バリデーション
     ============================================================ */

  // 全角/半角・大文字小文字・カタカナ/ひらがなを吸収した比較用キー
  function normalizeKey(name) {
    var s = String(name);
    if (s.normalize) s = s.normalize('NFKC');
    s = s.toLowerCase();
    // カタカナ → ひらがな
    s = s.replace(/[ァ-ヶ]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0x60);
    });
    // 記号・空白・長音を除去（"ま ん こ" のような回避を防ぐ）
    s = s.replace(/[\s　ーー・.,_\-~!"#$%&'()*+/:;<=>?@\[\\\]^`{|}]/g, '');
    return s;
  }

  // 使用できない語（卑猥・差別・暴力表現など）
  var NG_WORDS = [
    // 英語
    'fuck', 'fuk', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock',
    'penis', 'vagina', 'pussy', 'boobs', 'tits', 'cunt', 'slut', 'whore', 'porn',
    'sex', 'rape', 'nigger', 'nigga', 'faggot', 'retard', 'nazi', 'hitler',
    'murder', 'suicide', 'jerk', 'damn', 'crap', 'wank', 'horny', 'nude',
    'erotic', 'hentai', 'lolicon', 'incest', 'orgasm', 'masturbat',
    // 日本語（ひらがな正規化後に一致させる）
    'ちんこ', 'ちんぽ', 'ちんちん', 'ぺにす', 'まんこ', 'おまんこ', 'ばぎな',
    'おっぱい', 'ちくび', 'せっくす', 'やりまん', 'せいえき', 'ふぇら', 'なかだし',
    'いんけい', 'いんもう', 'ぼっき', 'おなにー', 'せんずり', 'しこしこ',
    'えっち', 'えろ', 'すけべ', 'へんたい', 'ろりこん', 'ちかん', 'のぞき',
    'れいぷ', 'ごうかん', 'ふうぞく', 'そーぷ', 'でりへる', 'ぬーど', 'らんこう',
    'きんたま', 'ふぐり', 'あなる', 'けつあな', 'しょんべん', 'うんこ', 'うんち',
    'くそ', 'ちんげ', 'びっち', 'ぱいずり', 'いんらん', 'ぶさいく', 'でぶ',
    'しね', 'ころす', 'ころして', 'じさつ', 'きちがい', 'きしょい', 'ばか', 'あほ',
    'まぬけ', 'ぶす', 'ごみくず', 'くたばれ', 'ぶっころ',
    'めくら', 'つんぼ', 'びっこ', 'かたわ',
    'ちょん', 'しなじん',
    // 漢字表記
    '死ね', '殺す', '自殺', '強姦', '痴漢', '売春', '援交', '射精', '勃起',
    '陰茎', '陰毛', '性交', '変態', '馬鹿', '阿呆', '基地外', '風俗', '乱交',
    // なりすまし防止
    'admin', 'administrator', 'root', 'system', 'moderator', 'staff',
    '管理人', '管理者', '運営', 'うんえい', 'かんりにん', 'かんりしゃ'
  ];

  function containsNgWord(name) {
    var key = normalizeKey(name);
    for (var i = 0; i < NG_WORDS.length; i++) {
      if (key.indexOf(normalizeKey(NG_WORDS[i])) !== -1) return true;
    }
    return false;
  }

  // 使用を許可する文字: ひらがな・カタカナ・漢字・英数字・長音・中黒・アンダースコア
  var ALLOWED_RE = /^[0-9A-Za-zぁ-ゖァ-ヺー一-鿿々・_]+$/;

  /**
   * @returns {{ok:boolean, name?:string, key?:string, message?:string}}
   */
  function validateUserName(rawInput) {
    var name = String(rawInput == null ? '' : rawInput).trim();
    if (name.normalize) name = name.normalize('NFKC');

    if (!name) return { ok: false, message: 'ユーザー名を入力してください。' };

    // 見た目の文字数（サロゲートペア＝絵文字などを1文字として数える）
    var chars = Array.from(name);
    if (chars.length < 2) return { ok: false, message: 'ユーザー名は2文字以上で入力してください。' };
    if (chars.length > 12) return { ok: false, message: 'ユーザー名は12文字以内で入力してください。' };

    if (!ALLOWED_RE.test(name)) {
      return { ok: false, message: 'ひらがな・カタカナ・漢字・英数字のみ使用できます。' };
    }
    if (containsNgWord(name)) {
      return { ok: false, message: 'その言葉はユーザー名に使用できません。' };
    }

    var key = normalizeKey(name);
    if (!key) return { ok: false, message: 'ユーザー名を入力してください。' };

    var store = readStore();
    if (Object.prototype.hasOwnProperty.call(store.users, key)) {
      return { ok: false, message: '「' + store.users[key].name + '」は既に使われています。別の名前にしてください。' };
    }
    return { ok: true, name: name, key: key };
  }

  /* ============================================================
     3. ユーザー操作
     ============================================================ */
  var currentKey = null;

  function currentUser() {
    var store = readStore();
    return currentKey ? store.users[currentKey] : null;
  }

  function saveUser(mutate) {
    var store = readStore();
    var u = store.users[currentKey];
    if (!u) return;
    mutate(u);
    u.lastPlayed = Date.now();
    store.current = currentKey;
    writeStore(store);
  }

  function createUser(name, key) {
    var store = readStore();
    store.users[key] = { name: name, created: Date.now(), lastPlayed: Date.now(), cleared: {}, lastStage: 1 };
    store.current = key;
    writeStore(store);
    currentKey = key;
  }

  function deleteUser(key) {
    var store = readStore();
    delete store.users[key];
    if (store.current === key) store.current = null;
    writeStore(store);
  }

  function clearedMap() {
    var u = currentUser();
    return (u && u.cleared) || {};
  }

  function highestCleared() {
    var c = clearedMap(), max = 0;
    for (var k in c) { var n = parseInt(k, 10); if (n > max) max = n; }
    return max;
  }

  function nextStage() {
    var c = clearedMap();
    for (var i = 1; i <= LEVELS.length; i++) {
      if (!c[i]) return i;
    }
    return LEVELS.length;
  }

  function isUnlocked(id) {
    return id <= highestCleared() + 1;
  }

  /* ============================================================
     4. レベルモデル（直進移動 + ソルバー）
     ============================================================ */

  /** 生データから、各マス・各方向の「まっすぐ並ぶマス列」を作る */
  function compile(raw) {
    var w = raw.w, h = raw.h, rows = raw.g;
    var idx = [], cells = [], n = 0;
    var y, x;
    for (y = 0; y < h; y++) {
      idx.push([]);
      for (x = 0; x < w; x++) {
        if (rows[y].charAt(x) === '.') { idx[y].push(n); cells.push({ x: x, y: y }); n++; }
        else idx[y].push(-1);
      }
    }
    // ray[i][d] = マス i から方向 d に、壁か盤面の端まで並ぶマスの並び
    var ray = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var d = 0; d < 4; d++) {
        var cx = cells[i].x, cy = cells[i].y, seq = [];
        for (;;) {
          var nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
          var ni = idx[ny][nx];
          if (ni < 0) break;
          seq.push(ni);
          cx = nx; cy = ny;
        }
        row.push(seq);
      }
      ray.push(row);
    }
    return {
      id: raw.id, w: w, h: h, rows: rows, cells: cells, idx: idx, n: n,
      start: idx[raw.s[1]][raw.s[0]], sol: raw.sol, ray: ray
    };
  }

  var compiled = {};
  function getLevel(id) {
    if (!compiled[id]) {
      var raw = LEVELS[id - 1];
      if (!raw) return null;
      compiled[id] = compile(raw);
    }
    return compiled[id];
  }

  /**
   * マス pos から方向 d に滑ったときに通るマスを返す。
   * 壁・盤面の端・すでに塗ったマスの手前で止まる。動けないときは空配列。
   */
  function slidePath(lv, pos, painted, d) {
    var seq = lv.ray[pos][d], path = [];
    for (var k = 0; k < seq.length; k++) {
      if (painted[seq[k]]) break;
      path.push(seq[k]);
    }
    return path;
  }

  /**
   * 現在の局面から全マスを塗り切れるかを深さ優先で探索する。
   * painted は破壊的に使い、呼び出し後は元に戻す。
   * @returns {string[]|null} 手順（空配列＝すでにクリア）／null＝解なし
   */
  function solveFrom(lv, pos, painted, remaining, budget) {
    if (remaining === 0) return [];
    if (--budget.left < 0) { budget.out = true; return null; }
    for (var d = 0; d < 4; d++) {
      var path = slidePath(lv, pos, painted, d);
      if (!path.length) continue;
      for (var k = 0; k < path.length; k++) painted[path[k]] = 1;
      var rest = solveFrom(lv, path[path.length - 1], painted, remaining - path.length, budget);
      for (k = 0; k < path.length; k++) painted[path[k]] = 0;
      if (rest) return [DCH.charAt(d)].concat(rest);
      if (budget.out) return null;
    }
    return null;
  }

  /* ============================================================
     5. 画面遷移
     ============================================================ */
  var screens = { login: $('screen-login'), select: $('screen-select'), game: $('screen-game') };

  function show(name) {
    for (var k in screens) screens[k].classList.toggle('is-active', k === name);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ============================================================
     6. ログイン画面
     ============================================================ */
  function renderLogin() {
    var store = readStore();
    var keys = Object.keys(store.users).sort(function (a, b) {
      return (store.users[b].lastPlayed || 0) - (store.users[a].lastPlayed || 0);
    });
    var wrap = $('user-list-wrap');
    var list = $('user-list');
    list.innerHTML = '';
    wrap.hidden = keys.length === 0;

    keys.forEach(function (key) {
      var u = store.users[key];
      var done = Object.keys(u.cleared || {}).length;
      var li = el('li');

      var btn = el('button', 'user-row');
      btn.type = 'button';
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ic');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#ic-user');
      svg.appendChild(use);
      btn.appendChild(svg);

      var nm = el('span', 'user-row-name');
      nm.textContent = u.name;
      btn.appendChild(nm);

      var meta = el('span', 'user-row-meta');
      meta.textContent = done + ' / ' + LEVELS.length + ' クリア';
      btn.appendChild(meta);

      btn.addEventListener('click', function () {
        currentKey = key;
        var s = readStore();
        s.current = key;
        writeStore(s);
        openSelect();
      });
      li.appendChild(btn);

      var del = el('button', 'user-del');
      del.type = 'button';
      del.textContent = '×';
      del.setAttribute('aria-label', u.name + ' を削除');
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (window.confirm('「' + u.name + '」のデータを削除します。よろしいですか？')) {
          deleteUser(key);
          renderLogin();
        }
      });
      li.appendChild(del);

      list.appendChild(li);
    });

    $('register-error').textContent = '';
    $('username-input').value = '';
  }

  $('register-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var res = validateUserName($('username-input').value);
    if (!res.ok) {
      $('register-error').textContent = res.message;
      return;
    }
    $('register-error').textContent = '';
    createUser(res.name, res.key);
    openSelect();
  });

  $('username-input').addEventListener('input', function () {
    $('register-error').textContent = '';
  });

  /* ============================================================
     7. ステージ選択画面
     ============================================================ */
  function openSelect() {
    var u = currentUser();
    if (!u) { show('login'); renderLogin(); return; }
    $('select-user').textContent = u.name;
    var done = Object.keys(u.cleared || {}).length;
    $('select-progress').textContent = 'クリア ' + done + ' / ' + LEVELS.length + '　（クリア時に自動保存）';

    var grid = $('stage-grid');
    grid.innerHTML = '';
    var cleared = clearedMap();
    var nxt = nextStage();

    for (var i = 1; i <= LEVELS.length; i++) {
      (function (id) {
        var li = el('li');
        var btn = el('button', 'stage-btn');
        btn.type = 'button';
        var rec = cleared[id];
        var unlocked = isUnlocked(id);

        if (!unlocked) {
          btn.classList.add('is-locked');
          btn.disabled = true;
          btn.innerHTML = '<svg class="ic"><use href="#ic-lock"/></svg>';
          btn.setAttribute('aria-label', 'Level ' + id + '（未開放）');
        } else {
          btn.textContent = id;
          btn.setAttribute('aria-label', 'Level ' + id);
          if (rec) {
            btn.classList.add('is-cleared');
            var stars = el('span', 'stage-stars');
            for (var s = 1; s <= 3; s++) {
              stars.innerHTML += '<svg class="ic' + (s <= rec.stars ? '' : ' off') + '"><use href="#ic-star"/></svg>';
            }
            btn.appendChild(stars);
          }
          if (id === nxt && !rec) btn.classList.add('is-next');
          btn.addEventListener('click', function () { startStage(id); });
        }
        li.appendChild(btn);
        grid.appendChild(li);
      })(i);
    }
    show('select');
  }

  $('select-back').addEventListener('click', function () {
    currentKey = null;
    var s = readStore(); s.current = null; writeStore(s);
    renderLogin();
    show('login');
  });
  $('select-continue').addEventListener('click', function () { startStage(nextStage()); });

  /* ============================================================
     8. ゲーム本体
     ============================================================ */
  var state = null;   // {lv, pos, painted(Uint8Array), count, moves[], hints}
  var busy = false;
  var pending = null;  // アニメーション中に入力された次の一手（1つだけ先読み）
  var cellEls = [];
  var playerEl = null;
  var boardEl = $('board');
  // board.innerHTML の初期化で失われないよう参照を保持しておく
  var hintEl = $('hint-arrow');
  var hintTimer = null;
  var paintTimers = [];

  function startStage(id) {
    var lv = getLevel(id);
    if (!lv) return;
    pending = null;
    state = {
      lv: lv,
      pos: lv.start,
      painted: new Uint8Array(lv.n),
      count: 0,
      moves: [],
      hints: 0
    };
    markPainted(lv.start);
    saveUser(function (u) { u.lastStage = id; });

    $('level-label').textContent = 'Level ' + id;
    $('stat-best').textContent = lv.sol.length;
    $('hint-badge').textContent = '0';
    $('hint-badge').classList.add('is-zero');
    hideHint();
    buildBoard();
    updateStats();
    show('game');
    requestAnimationFrame(fitBoard);
  }

  function markPainted(i) {
    if (state.painted[i]) return false;
    state.painted[i] = 1;
    state.count++;
    return true;
  }

  function buildBoard() {
    var lv = state.lv;
    paintTimers.forEach(clearTimeout);
    paintTimers = [];
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = 'repeat(' + lv.w + ', var(--cell))';
    cellEls = new Array(lv.n);

    for (var y = 0; y < lv.h; y++) {
      for (var x = 0; x < lv.w; x++) {
        var i = lv.idx[y][x];
        var c = el('div', 'cell');
        if (i < 0) {
          c.classList.add('is-wall');   // 緑のブロック＝進入できないマス
        } else {
          cellEls[i] = c;
          if (state.painted[i]) c.classList.add('is-filled');
        }
        boardEl.appendChild(c);
      }
    }

    boardEl.appendChild(hintEl);   // 盤面座標で位置決めするため board の子にする
    playerEl = el('div', 'player');
    playerEl.innerHTML = '<span class="player-cap"></span><span class="player-body"></span>';
    boardEl.appendChild(playerEl);
    placePlayer(true);
  }

  function placePlayer(instant) {
    if (!playerEl) return;
    var c = state.lv.cells[state.pos];
    if (instant) playerEl.style.transitionDuration = '0ms';
    playerEl.style.transform = 'translate(calc(var(--cell) * ' + c.x + '), calc(var(--cell) * ' + c.y + '))';
  }

  function fitBoard() {
    if (!state) return;
    var area = document.querySelector('.board-area');
    var lv = state.lv;
    var availW = area.clientWidth - 26;
    var availH = area.clientHeight - 26;
    if (availW <= 0 || availH <= 0) return;
    var size = Math.floor(Math.min(availW / lv.w, availH / lv.h));
    size = Math.max(16, Math.min(96, size));
    boardEl.style.setProperty('--cell', size + 'px');
    boardEl.parentElement.style.setProperty('--cell', size + 'px');
  }
  window.addEventListener('resize', fitBoard);
  window.addEventListener('orientationchange', function () { setTimeout(fitBoard, 200); });

  function updateStats() {
    $('stat-moves').textContent = state.moves.length;
    $('stat-left').textContent = state.lv.n - state.count;
  }

  /* ---------- 移動 ---------- */
  function move(d) {
    if (!state) return;
    // アニメーション中の入力は捨てずに1手だけ保持し、終わり次第つなげて動かす
    if (busy) { pending = d; return; }
    var path = slidePath(state.lv, state.pos, state.painted, d);
    if (!path.length) {
      boardEl.classList.remove('is-shake');
      void boardEl.offsetWidth;
      boardEl.classList.add('is-shake');
      return;
    }
    hideHint();
    busy = true;
    state.moves.push(DCH.charAt(d));
    state.pos = path[path.length - 1];

    var steps = path.length;
    var per = Math.max(42, Math.min(96, 300 / steps));
    var dur = per * steps;

    playerEl.style.transitionDuration = dur + 'ms';
    // 次フレームで transform を適用（duration 変更を確実に反映させる）
    requestAnimationFrame(function () { placePlayer(false); });

    path.forEach(function (ci, k) {
      paintTimers.push(setTimeout(function () {
        if (markPainted(ci) && cellEls[ci]) cellEls[ci].classList.add('is-filled');
        updateStats();
      }, per * k + per * 0.55));
    });

    paintTimers.push(setTimeout(function () {
      busy = false;
      updateStats();
      if (state.count === state.lv.n) {
        pending = null;
        onClear();
      } else if (pending !== null) {
        var nx = pending;
        pending = null;
        move(nx);
      }
    }, dur + 40));
  }

  /* ---------- クリア ---------- */
  function onClear() {
    var lv = state.lv;
    var used = state.moves.length;
    var opt = lv.sol.length;
    var stars = used <= opt ? 3 : (used <= opt + 2 ? 2 : 1);
    if (state.hints > 0) stars = Math.min(stars, 2);

    // 盤面をきらめかせる
    cellEls.forEach(function (c, i) {
      if (!c) return;
      paintTimers.push(setTimeout(function () { c.classList.add('is-goalflash'); }, i * 6));
    });

    // ---- オートセーブ ----
    saveUser(function (u) {
      if (!u.cleared) u.cleared = {};
      var prev = u.cleared[lv.id];
      u.cleared[lv.id] = {
        stars: Math.max(stars, prev ? prev.stars : 0),
        moves: prev ? Math.min(used, prev.moves) : used,
        at: Date.now()
      };
      u.lastStage = Math.min(lv.id + 1, LEVELS.length);
    });

    setTimeout(function () {
      $('clear-title').textContent = 'Level ' + lv.id;
      var starEls = $('clear-stars').querySelectorAll('.ic');
      for (var i = 0; i < starEls.length; i++) {
        starEls[i].classList.toggle('on', i < stars);
      }
      $('clear-detail').textContent = used + ' 手でクリア（最短 ' + opt + ' 手）'
        + (state.hints ? '　ヒント ' + state.hints + ' 回' : '');
      $('clear-next').textContent = lv.id >= LEVELS.length ? '全ステージ制覇！' : '次のステージへ';
      openModal('modal-clear');
    }, Math.min(700, lv.n * 6 + 300));
  }

  $('clear-next').addEventListener('click', function () {
    var id = state.lv.id;
    closeModal('modal-clear');
    if (id >= LEVELS.length) { openSelect(); return; }
    startStage(id + 1);
  });
  $('clear-select').addEventListener('click', function () {
    closeModal('modal-clear');
    openSelect();
  });

  /* ---------- ヒント ---------- */
  function requestHint() {
    if (!state || busy) return;
    var lv = state.lv;
    var hist = state.moves.join('');
    var d = -1;

    // 用意された手順をなぞっている間は、その次の手を返す
    if (lv.sol.indexOf(hist) === 0 && hist.length < lv.sol.length) {
      d = DCH.indexOf(lv.sol.charAt(hist.length));
    } else {
      var copy = new Uint8Array(state.painted);
      var budget = { left: SOLVE_BUDGET, out: false };
      var path = solveFrom(lv, state.pos, copy, lv.n - state.count, budget);
      if (budget.out) {
        toast('ヒントを計算できませんでした。');
        return;
      }
      if (!path) {
        toast('この局面からはクリアできません。↪ でやり直してください。');
        return;
      }
      if (!path.length) return;
      d = DCH.indexOf(path[0]);
    }
    if (d < 0) return;

    state.hints++;
    $('hint-badge').textContent = state.hints;
    $('hint-badge').classList.remove('is-zero');
    showHint(d);
  }

  function showHint(d) {
    var path = slidePath(state.lv, state.pos, state.painted, d);
    if (!path.length) return;
    var c = state.lv.cells[path[0]];   // 進む方向の隣のマスに矢印を置く
    var a = hintEl;
    a.style.transform = 'translate(calc(var(--cell) * ' + c.x + '), calc(var(--cell) * ' + c.y + ')) '
      + 'rotate(' + (d === 0 ? 0 : d === 1 ? 180 : d === 2 ? -90 : 90) + 'deg)';
    a.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 3000);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hintEl.hidden = true;
  }

  /* ---------- ボタン ---------- */
  $('btn-retry').addEventListener('click', function () {
    if (!state) return;
    startStage(state.lv.id);
  });
  $('btn-hint').addEventListener('click', requestHint);
  $('btn-pause').addEventListener('click', function () {
    if (!state) return;
    openModal('modal-pause');
  });
  $('game-back').addEventListener('click', openSelect);

  $('pause-resume').addEventListener('click', function () { closeModal('modal-pause'); });
  $('pause-restart').addEventListener('click', function () {
    closeModal('modal-pause');
    startStage(state.lv.id);
  });
  $('pause-select').addEventListener('click', function () {
    closeModal('modal-pause');
    openSelect();
  });
  $('pause-logout').addEventListener('click', function () {
    closeModal('modal-pause');
    currentKey = null;
    var s = readStore(); s.current = null; writeStore(s);
    renderLogin();
    show('login');
  });

  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }

  function anyModalOpen() {
    return !$('modal-pause').hidden || !$('modal-clear').hidden;
  }

  /* ---------- 入力 ---------- */
  var KEYMAP = {
    ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3,
    w: 0, s: 1, a: 2, d: 3, W: 0, S: 1, A: 2, D: 3,
    k: 0, j: 1, h: 2, l: 3
  };
  window.addEventListener('keydown', function (ev) {
    if (!screens.game.classList.contains('is-active')) return;
    if (ev.key === 'Escape') {
      if (!$('modal-pause').hidden) closeModal('modal-pause');
      else if ($('modal-clear').hidden) openModal('modal-pause');
      return;
    }
    if (anyModalOpen()) return;
    if (ev.key === 'r' || ev.key === 'R') { startStage(state.lv.id); return; }
    var d = KEYMAP[ev.key];
    if (d === undefined) return;
    ev.preventDefault();
    move(d);
  });

  // スワイプ
  var sw = null;
  var gameEl = screens.game;
  gameEl.addEventListener('pointerdown', function (ev) {
    if (anyModalOpen()) return;
    if (ev.target.closest('button')) return;
    sw = { x: ev.clientX, y: ev.clientY, t: Date.now() };
  });
  gameEl.addEventListener('pointerup', function (ev) {
    if (!sw) return;
    var dx = ev.clientX - sw.x, dy = ev.clientY - sw.y;
    sw = null;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 3 : 2);
    else move(dy > 0 ? 1 : 0);
  });
  gameEl.addEventListener('pointercancel', function () { sw = null; });
  gameEl.addEventListener('touchmove', function (ev) { ev.preventDefault(); }, { passive: false });

  /* ============================================================
     9. 起動
     ============================================================ */
  function boot() {
    if (!LEVELS.length) {
      document.body.innerHTML = '<p style="color:#fff;padding:24px;font:16px sans-serif">'
        + 'ステージデータ(levels.js)を読み込めませんでした。</p>';
      return;
    }
    var store = readStore();
    if (store.current && store.users[store.current]) {
      currentKey = store.current;
      openSelect();
    } else {
      renderLogin();
      show('login');
    }
  }

  boot();
})();
