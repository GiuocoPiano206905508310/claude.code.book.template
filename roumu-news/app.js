// ============================================================================
// 労務ニュース便覧: 記事一覧・お気に入り画面のロジック
// ============================================================================

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const TAG_LABEL = { ministry: '省庁情報', news: 'ニュース', pamphlet: 'パンフレット' };

// ---------- 外観設定（ダークモード） ----------
const THEME_STORAGE_KEY = 'themePreference';

function applyThemePreference(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setThemePreference(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) { /* localStorage不可の環境では即時反映のみ行う */ }
  applyThemePreference(theme);
}

// 現在ダーク表示になっているか（設定で明示していなければ端末の設定に従う）
function isDarkModeActive() {
  let stored = null;
  try { stored = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { /* noop */ }
  if (stored === 'light') return false;
  if (stored === 'dark') return true;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// ---------- 記事の表示設定（非表示フィルタ） ----------
const HIDE_SETTINGS_KEY = 'roumuNewsHideSettings';

function getHideSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDE_SETTINGS_KEY) || '{}');
    return {
      hidePaid: !!raw.hidePaid,
      hidePamphlet: !!raw.hidePamphlet,
      hideRead: !!raw.hideRead,
    };
  } catch (e) {
    return { hidePaid: false, hidePamphlet: false, hideRead: false };
  }
}

function setHideSetting(key, value) {
  const current = getHideSettings();
  current[key] = value;
  try { localStorage.setItem(HIDE_SETTINGS_KEY, JSON.stringify(current)); } catch (e) { /* noop */ }
}

// ---------- 既読記事（この端末のみで保持。直近500件までに切り詰める） ----------
const READ_IDS_KEY = 'roumuNewsReadIds';

function getReadIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(READ_IDS_KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function markArticleRead(id) {
  const ids = Array.from(getReadIds());
  if (ids.includes(id)) return;
  ids.push(id);
  const trimmed = ids.length > 500 ? ids.slice(ids.length - 500) : ids;
  try { localStorage.setItem(READ_IDS_KEY, JSON.stringify(trimmed)); } catch (e) { /* noop */ }
}

let articles = [];
let favoriteIds = new Set();
const state = { tab: 'latest', filter: 'all' };

const listEl = document.getElementById('list');
const tabLatest = document.getElementById('tabLatest');
const tabFav = document.getElementById('tabFav');
const filtersEl = document.getElementById('filters');
const countFavEl = document.getElementById('countFav');
const countLatestEl = document.getElementById('countLatest');
const toastEl = document.getElementById('toast');
const userLabelEl = document.getElementById('userLabel');
const syncBtn = document.getElementById('syncBtn');
const syncLabel = document.getElementById('syncLabel');
const syncMeta = document.getElementById('syncMeta');

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function starSVG(filled) {
  return `<svg viewBox="0 0 20 20" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 1.6l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.4-4.1 6-.7z"/></svg>`;
}
function openSVG() {
  return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5H5v10h10v-3"/><path d="M12 3h5v5"/><path d="M8.5 11.5L17 3"/></svg>';
}

function formatSyncMeta(run) {
  if (!run) return '最終更新: まだ取得されていません';
  const d = new Date(run.ranAt);
  const jp = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (!run.ok) return `最終更新: ${jp}（一部の取得に失敗しました）`;
  return `最終更新: ${jp}（${run.articlesUpserted}件を確認）`;
}

function render() {
  const hideSettings = getHideSettings();
  const readIds = getReadIds();

  let visible = articles;
  if (hideSettings.hidePaid) visible = visible.filter((a) => !a.isPaid);
  if (hideSettings.hidePamphlet) visible = visible.filter((a) => a.category !== 'pamphlet');
  if (hideSettings.hideRead) visible = visible.filter((a) => !readIds.has(a.id));

  let pool = visible;
  if (state.tab === 'favorites') {
    pool = pool.filter((a) => favoriteIds.has(a.id));
  } else if (state.filter === 'paid') {
    pool = pool.filter((a) => a.isPaid);
  } else if (state.filter !== 'all') {
    pool = pool.filter((a) => a.category === state.filter);
  }

  countFavEl.textContent = String(visible.filter((a) => favoriteIds.has(a.id)).length);
  countLatestEl.textContent = String(visible.length);

  listEl.innerHTML = '';

  if (pool.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'news-empty';
    empty.innerHTML = state.tab === 'favorites'
      ? starSVG(false) + '<p>お気に入りに登録した記事はまだありません。<br>記事右上の☆をタップすると、ここに一覧表示されます。</p>'
      : starSVG(false) + '<p>該当する記事がありません。</p>';
    listEl.appendChild(empty);
    return;
  }

  const today = todayStr();
  pool.forEach((a) => {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `${a.title}（外部サイトを開く）`);

    const isFav = favoriteIds.has(a.id);
    const isNew = a.publishedDate === today;

    card.innerHTML = `
      <div class="news-card-top">
        ${isNew ? '<span class="news-new-dot" title="本日更新"></span>' : ''}
        <span class="news-tag news-tag-${a.category}">${TAG_LABEL[a.category]}</span>
        ${a.isPaid ? '<span class="news-tag news-tag-paid">有料</span>' : ''}
        <span class="news-source">${escapeHtml(a.source)}</span>
      </div>
      <h3>${escapeHtml(a.title)}</h3>
      ${a.summary ? `
      <p class="news-summary">${escapeHtml(a.summary)}</p>
      <button class="news-expand-btn" aria-expanded="false" type="button">
        <span class="chevron">▼</span><span class="expand-label">概要をもっと見る</span>
      </button>` : ''}
      <div class="news-card-bottom">
        <span class="news-date">${formatDate(a.publishedDate)}</span>
        <span class="news-open-hint">${openSVG()}${a.category === 'pamphlet' ? '資料を開く' : '元記事を開く'}</span>
      </div>
      <button class="news-star-btn" aria-pressed="${isFav}" aria-label="お気に入り${isFav ? '解除' : '登録'}" type="button">${starSVG(isFav)}</button>
    `;

    const go = () => {
      window.open(a.url, '_blank', 'noopener,noreferrer');
      if (!getReadIds().has(a.id)) {
        markArticleRead(a.id);
        if (getHideSettings().hideRead) render();
      }
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });

    const expandBtn = card.querySelector('.news-expand-btn');
    const summaryEl = card.querySelector('.news-summary');
    if (expandBtn && summaryEl) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = summaryEl.classList.toggle('is-expanded');
        expandBtn.setAttribute('aria-expanded', String(expanded));
        expandBtn.querySelector('.chevron').textContent = expanded ? '▲' : '▼';
        expandBtn.querySelector('.expand-label').textContent = expanded ? '閉じる' : '概要をもっと見る';
      });
      expandBtn.addEventListener('keydown', (e) => e.stopPropagation());
    }

    const starBtn = card.querySelector('.news-star-btn');
    starBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      starBtn.disabled = true;
      try {
        if (favoriteIds.has(a.id)) {
          favoriteIds.delete(a.id);
          await removeFavorite(a.id);
          showToast('お気に入りを解除しました');
        } else {
          favoriteIds.add(a.id);
          await addFavorite(a.id);
          showToast('お気に入りに追加しました');
        }
      } catch (err) {
        showToast('通信に失敗しました。もう一度お試しください。');
        // 失敗時は表示状態を元に戻す
        if (favoriteIds.has(a.id)) favoriteIds.delete(a.id); else favoriteIds.add(a.id);
      }
      starBtn.disabled = false;
      render();
    });
    starBtn.addEventListener('keydown', (e) => e.stopPropagation());

    listEl.appendChild(card);
  });
}

tabLatest.addEventListener('click', () => {
  state.tab = 'latest';
  tabLatest.setAttribute('aria-selected', 'true');
  tabFav.setAttribute('aria-selected', 'false');
  filtersEl.hidden = false;
  render();
});
tabFav.addEventListener('click', () => {
  state.tab = 'favorites';
  tabFav.setAttribute('aria-selected', 'true');
  tabLatest.setAttribute('aria-selected', 'false');
  filtersEl.hidden = true;
  render();
});

filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.news-chip');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  Array.from(filtersEl.children).forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
  render();
});

// ---------- 設定パネル ----------
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const toggleDarkMode = document.getElementById('toggleDarkMode');
const toggleHidePaid = document.getElementById('toggleHidePaid');
const toggleHidePamphlet = document.getElementById('toggleHidePamphlet');
const toggleHideRead = document.getElementById('toggleHideRead');

function openSettings() {
  const hideSettings = getHideSettings();
  toggleDarkMode.setAttribute('aria-checked', String(isDarkModeActive()));
  toggleHidePaid.setAttribute('aria-checked', String(hideSettings.hidePaid));
  toggleHidePamphlet.setAttribute('aria-checked', String(hideSettings.hidePamphlet));
  toggleHideRead.setAttribute('aria-checked', String(hideSettings.hideRead));
  settingsOverlay.hidden = false;
}
function closeSettings() { settingsOverlay.hidden = true; }

settingsBtn.addEventListener('click', openSettings);
settingsCloseBtn.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });

toggleDarkMode.addEventListener('click', () => {
  const next = toggleDarkMode.getAttribute('aria-checked') !== 'true';
  toggleDarkMode.setAttribute('aria-checked', String(next));
  setThemePreference(next ? 'dark' : 'light');
});

function wireHideToggle(btn, key) {
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    setHideSetting(key, next);
    render();
  });
}
wireHideToggle(toggleHidePaid, 'hidePaid');
wireHideToggle(toggleHidePamphlet, 'hidePamphlet');
wireHideToggle(toggleHideRead, 'hideRead');

async function loadArticles() {
  const [articleList, favIds, lastRun] = await Promise.all([
    listArticles(),
    listFavoriteArticleIds(),
    getLastSyncRun(),
  ]);
  articles = articleList;
  favoriteIds = favIds;
  syncMeta.textContent = formatSyncMeta(lastRun);
  render();
}

syncBtn.addEventListener('click', async () => {
  if (syncBtn.classList.contains('spinning')) return;
  syncBtn.classList.add('spinning');
  syncLabel.textContent = '確認中…';
  try {
    await loadArticles();
    showToast('最新の情報を確認しました');
  } catch (err) {
    showToast('通信に失敗しました。もう一度お試しください。');
  }
  syncBtn.classList.remove('spinning');
  syncLabel.textContent = '最新の状態を確認';
});

(async () => {
  const user = await requireAuth('login.html');
  if (!user) return;
  userLabelEl.innerHTML = `${escapeHtml(currentUsername(user))} さん・<a href="#" id="logoutLink" style="color:var(--indigo);">ログアウト</a>`;
  document.getElementById('logoutLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
    location.href = 'login.html';
  });

  try {
    await loadArticles();
  } catch (err) {
    listEl.innerHTML = '<div class="news-empty"><p>記事の取得に失敗しました。通信環境をご確認のうえ、画面を再読み込みしてください。</p></div>';
  }
})();
