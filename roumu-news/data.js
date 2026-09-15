// ============================================================================
// データ層。Supabase（Postgres + RLS）から記事一覧・お気に入りを取得する。
// 記事データ（news_articles）は fetch-daily-news Edge Function が毎日
// 書き込む読み取り専用のテーブル。お気に入り（news_favorites）だけが
// 利用者本人の書き込み対象。
// ============================================================================

async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインしていません。');
  return user.id;
}

function articleRowToObj(row) {
  return {
    id: row.id,
    source: row.source,
    category: row.category, // 'ministry' | 'news' | 'pamphlet'
    title: row.title,
    summary: row.summary || '',
    url: row.url,
    isPaid: !!row.is_paid,
    publishedDate: row.published_date, // 'YYYY-MM-DD'
  };
}

// 記事一覧を新着順に取得する（limitで件数を絞れる。既定200件）
async function listArticles(limit) {
  const { data, error } = await supabaseClient
    .from('news_articles')
    .select('*')
    .order('published_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit || 200);
  if (error) throw error;
  return data.map(articleRowToObj);
}

// ログイン中の利用者がお気に入り登録している記事IDの集合を取得する
async function listFavoriteArticleIds() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabaseClient
    .from('news_favorites')
    .select('article_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((row) => row.article_id));
}

async function addFavorite(articleId) {
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient
    .from('news_favorites')
    .insert({ user_id: userId, article_id: articleId });
  // 既に登録済み（一意制約違反）の場合はエラーにしない
  if (error && error.code !== '23505') throw error;
}

async function removeFavorite(articleId) {
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient
    .from('news_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('article_id', articleId);
  if (error) throw error;
}

// 毎日の自動更新が最後に実行された日時を取得する（画面の「最終更新」表示用）。
// 実行履歴が1件も無い場合はnull
async function getLastSyncRun() {
  const { data, error } = await supabaseClient
    .from('news_sync_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ranAt: data.ran_at, articlesUpserted: data.articles_upserted, ok: data.ok, message: data.message || '' };
}
