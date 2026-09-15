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

// ---------- おすすめトピック（社労士業務に関わりそうな分野。税務も含む） ----------
const TOPICS = [
  { id: 'social-insurance', label: '社会保険・厚生年金', keywords: ['社会保険', '厚生年金', '標準報酬'] },
  { id: 'labor-standards', label: '労働基準・労働時間', keywords: ['労働基準', '36協定', '労働時間', '時間外労働', '割増賃金'] },
  { id: 'minimum-wage', label: '最低賃金', keywords: ['最低賃金'] },
  { id: 'employment-labor-insurance', label: '雇用保険・労災保険', keywords: ['雇用保険', '労災保険', '労働保険'] },
  { id: 'childcare-leave', label: '育児・介護休業', keywords: ['育児休業', '介護休業', '育児・介護'] },
  { id: 'equal-pay', label: '同一労働同一賃金・非正規雇用', keywords: ['同一労働同一賃金', 'パートタイム', '有期雇用', '非正規'] },
  { id: 'harassment', label: 'ハラスメント対策', keywords: ['ハラスメント', 'パワハラ', 'セクハラ'] },
  { id: 'foreign-workers', label: '外国人雇用', keywords: ['外国人労働者', '技能実習', '特定技能'] },
  { id: 'tax', label: '税務・年末調整', keywords: ['年末調整', '源泉徴収', '所得税', '確定申告', '税制'] },
  { id: 'disability-employment', label: '障害者雇用', keywords: ['障害者雇用'] },
  { id: 'subsidies', label: '助成金・給付金', keywords: ['助成金', '給付金', '支援金'] },
];

const TOPICS_STORAGE_KEY = 'roumuNewsInterestedTopics';

function getInterestedTopicIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(TOPICS_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function setTopicChecked(id, checked) {
  const ids = getInterestedTopicIds();
  if (checked) ids.add(id); else ids.delete(id);
  try { localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(Array.from(ids))); } catch (e) { /* noop */ }
}

function getInterestedKeywords() {
  const ids = getInterestedTopicIds();
  return TOPICS.filter((t) => ids.has(t.id)).flatMap((t) => t.keywords);
}

function articleMatchesKeywords(article, keywords) {
  if (!keywords.length) return false;
  const text = `${article.title} ${article.summary}`;
  return keywords.some((k) => text.includes(k));
}

// ---------- 並び替え ----------
function sortArticles(list, mode, keywords) {
  const sorted = list.slice();
  if (mode === 'oldest') {
    sorted.sort((a, b) => (a.publishedDate < b.publishedDate ? -1 : a.publishedDate > b.publishedDate ? 1 : 0));
  } else if (mode === 'recommended') {
    sorted.sort((a, b) => {
      const am = articleMatchesKeywords(a, keywords) ? 1 : 0;
      const bm = articleMatchesKeywords(b, keywords) ? 1 : 0;
      if (am !== bm) return bm - am;
      return a.publishedDate < b.publishedDate ? 1 : a.publishedDate > b.publishedDate ? -1 : 0;
    });
  } else {
    sorted.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : a.publishedDate > b.publishedDate ? -1 : 0));
  }
  return sorted;
}

let articles = [];
let favoriteIds = new Set();
const state = { tab: 'latest', filter: 'all', search: '', sort: 'newest' };

const listEl = document.getElementById('list');
const tabLatest = document.getElementById('tabLatest');
const tabFav = document.getElementById('tabFav');
const filtersEl = document.getElementById('filters');
const countFavEl = document.getElementById('countFav');
const countLatestEl = document.getElementById('countLatest');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
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

function updateChipCounts(scopedList, keywords) {
  filtersEl.querySelectorAll('.news-chip').forEach((chip) => {
    const filter = chip.dataset.filter;
    let count;
    if (filter === 'all') count = scopedList.length;
    else if (filter === 'recommended') count = scopedList.filter((a) => articleMatchesKeywords(a, keywords)).length;
    else if (filter === 'paid') count = scopedList.filter((a) => a.isPaid).length;
    else count = scopedList.filter((a) => a.category === filter).length;

    let countEl = chip.querySelector('.news-chip-count');
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.className = 'news-chip-count';
      chip.appendChild(countEl);
    }
    countEl.textContent = String(count);
  });
}

function emptyMessageHtml(keywords) {
  if (state.tab === 'favorites') {
    return 'お気に入りに登録した記事はまだありません。<br>記事右上の☆をタップすると、ここに一覧表示されます。';
  }
  if (state.search.trim()) {
    return '検索条件に一致する記事がありません。';
  }
  if (state.filter === 'recommended') {
    return keywords.length === 0
      ? 'おすすめトピックがまだ選ばれていません。<br>設定 → おすすめトピックから興味のある分野を選んでください。'
      : '選択したトピックに一致する記事は、現在配信中の記事の中にはまだありません。';
  }
  if (state.filter === 'news' || state.filter === 'pamphlet') {
    return '現在、この分類の記事はまだありません。<br>今は厚生労働省の新着情報のみを配信しているためです。';
  }
  return '該当する記事がありません。';
}

function render() {
  const hideSettings = getHideSettings();
  const readIds = getReadIds();
  const keywords = getInterestedKeywords();

  let visible = articles;
  if (hideSettings.hidePaid) visible = visible.filter((a) => !a.isPaid);
  if (hideSettings.hidePamphlet) visible = visible.filter((a) => a.category !== 'pamphlet');
  if (hideSettings.hideRead) visible = visible.filter((a) => !readIds.has(a.id));

  const searchTerm = state.search.trim().toLowerCase();
  const searchScoped = searchTerm
    ? visible.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(searchTerm))
    : visible;

  updateChipCounts(searchScoped, keywords);

  let pool = searchScoped;
  if (state.tab === 'favorites') {
    pool = pool.filter((a) => favoriteIds.has(a.id));
  } else if (state.filter === 'paid') {
    pool = pool.filter((a) => a.isPaid);
  } else if (state.filter === 'recommended') {
    pool = pool.filter((a) => articleMatchesKeywords(a, keywords));
  } else if (state.filter !== 'all') {
    pool = pool.filter((a) => a.category === state.filter);
  }

  pool = sortArticles(pool, state.sort, keywords);

  countFavEl.textContent = String(searchScoped.filter((a) => favoriteIds.has(a.id)).length);
  countLatestEl.textContent = String(searchScoped.length);

  listEl.innerHTML = '';

  if (pool.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'news-empty';
    empty.innerHTML = starSVG(false) + `<p>${emptyMessageHtml(keywords)}</p>`;
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

let searchDebounceTimer;
searchInput.addEventListener('input', () => {
  state.search = searchInput.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 150);
});

sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
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
const topicsListEl = document.getElementById('topicsList');

function renderTopicsSettings() {
  const checkedIds = getInterestedTopicIds();
  topicsListEl.innerHTML = TOPICS.map((t) => `
    <div class="settings-row">
      <div class="settings-row-text">
        <div class="settings-row-label">${escapeHtml(t.label)}</div>
      </div>
      <button class="toggle-switch" data-topic-id="${t.id}" type="button" role="switch" aria-checked="${checkedIds.has(t.id)}" aria-label="${escapeHtml(t.label)}"><span class="toggle-knob"></span></button>
    </div>
  `).join('');
}

topicsListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-switch');
  if (!btn) return;
  const id = btn.dataset.topicId;
  const next = btn.getAttribute('aria-checked') !== 'true';
  btn.setAttribute('aria-checked', String(next));
  setTopicChecked(id, next);
  render();
});

function openSettings() {
  const hideSettings = getHideSettings();
  toggleDarkMode.setAttribute('aria-checked', String(isDarkModeActive()));
  toggleHidePaid.setAttribute('aria-checked', String(hideSettings.hidePaid));
  toggleHidePamphlet.setAttribute('aria-checked', String(hideSettings.hidePamphlet));
  toggleHideRead.setAttribute('aria-checked', String(hideSettings.hideRead));
  renderTopicsSettings();
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
