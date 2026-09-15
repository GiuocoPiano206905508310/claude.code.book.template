// ============================================================================
// 労務ニュース便覧: 記事一覧・お気に入り画面のロジック
// ============================================================================

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const TAG_LABEL = { ministry: '省庁情報', news: 'ニュース', pamphlet: 'パンフレット' };

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
  let pool = articles;
  if (state.tab === 'favorites') {
    pool = pool.filter((a) => favoriteIds.has(a.id));
  } else if (state.filter === 'paid') {
    pool = pool.filter((a) => a.isPaid);
  } else if (state.filter !== 'all') {
    pool = pool.filter((a) => a.category === state.filter);
  }

  countFavEl.textContent = String(favoriteIds.size);
  countLatestEl.textContent = String(articles.length);

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
      <p class="news-summary">${escapeHtml(a.summary)}</p>
      <div class="news-card-bottom">
        <span class="news-date">${formatDate(a.publishedDate)}</span>
        <span class="news-open-hint">${openSVG()}${a.category === 'pamphlet' ? '資料を開く' : '元記事を開く'}</span>
      </div>
      <button class="news-star-btn" aria-pressed="${isFav}" aria-label="お気に入り${isFav ? '解除' : '登録'}" type="button">${starSVG(isFav)}</button>
    `;

    const go = () => window.open(a.url, '_blank', 'noopener,noreferrer');
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });

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
