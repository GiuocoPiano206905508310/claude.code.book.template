// ============================================================================
// 認証ヘルパー（ユーザー名＋パスワードのみ。メールアドレスの概念はユーザーに
// 見せず、ユーザー名から一意に決まる内部専用メールアドレスをSupabase Auth
// 用に裏側で生成して使う）。給与・勤怠管理システムと同じSupabaseプロジェクトを
// 使うが、AUTH_EMAIL_DOMAINを別にすることでアカウントの名前空間を分けている。
//
// ドメイン末尾は「.internal」等のIANA予約済み特殊用途ドメイン
// （.test/.example/.invalid/.localhost/.local/.internal など）にしないこと。
// Supabase Auth（GoTrue）のメール形式チェックがこれらを "invalid" として
// 拒否するため、新規登録が常に失敗する（実際に .internal で発生した不具合）。
// ============================================================================

const AUTH_EMAIL_DOMAIN = 'roumu-news-app-account.com';

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

async function signUpWithUsername(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) throw error;
  return data;
}

async function signInWithUsername(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.user : null;
}

function currentUsername(user) {
  if (!user) return '';
  return (user.user_metadata && user.user_metadata.username) || user.email.split('@')[0];
}

// 未ログインならログイン画面へリダイレクトする。ログイン済みならuserを返す。
// 各保護ページの先頭で呼び出す。
async function requireAuth(loginPath, nextValue) {
  const user = await getCurrentUser();
  if (!user) {
    const here = encodeURIComponent(nextValue || location.pathname.split('/').pop());
    location.href = `${loginPath || 'login.html'}?next=${here}`;
    return null;
  }
  return user;
}
