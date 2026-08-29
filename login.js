// ============================================================================
// ログイン画面のロジック
// ============================================================================

function getNextPage() {
  const params = new URLSearchParams(location.search);
  return params.get('next') || 'index.html';
}

// ブラウザによってネットワーク接続失敗時のエラー文言が異なる
// （Chrome/Edge: "Failed to fetch"、Safari: "Load failed"、
// Firefox: "NetworkError when attempting to fetch resource"）ため、
// いずれにも該当するかどうかで判定する
function isNetworkFetchError(error) {
  const msg = (error && error.message) || '';
  return msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('NetworkError');
}

function friendlyAuthError(error) {
  const msg = (error && error.message) || '';
  if (msg.includes('Invalid login credentials')) return 'ユーザー名またはパスワードが正しくありません。';
  if (msg.includes('User already registered')) return 'このユーザー名は既に登録されています。別のユーザー名を使用してください。';
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で設定してください。';
  if (isNetworkFetchError(error)) return '通信に失敗しました。インターネット接続をご確認のうえ、しばらくしてから再度お試しください。';
  return 'エラーが発生しました：' + msg;
}

document.getElementById('tabLoginBtn').addEventListener('click', () => {
  document.getElementById('tabLoginBtn').classList.add('active');
  document.getElementById('tabSignupBtn').classList.remove('active');
  document.getElementById('loginPanel').style.display = '';
  document.getElementById('signupPanel').style.display = 'none';
});
document.getElementById('tabSignupBtn').addEventListener('click', () => {
  document.getElementById('tabSignupBtn').classList.add('active');
  document.getElementById('tabLoginBtn').classList.remove('active');
  document.getElementById('signupPanel').style.display = '';
  document.getElementById('loginPanel').style.display = 'none';
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';
  if (!username || !password) {
    errorEl.textContent = 'ユーザー名とパスワードを入力してください。';
    return;
  }
  try {
    await signInWithUsername(username, password);
    location.href = getNextPage();
  } catch (e) {
    errorEl.textContent = friendlyAuthError(e);
  }
});

document.getElementById('signupBtn').addEventListener('click', async () => {
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupPasswordConfirm').value;
  const errorEl = document.getElementById('signupError');
  errorEl.textContent = '';

  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
    errorEl.textContent = 'ユーザー名は3〜32文字の半角英数字・ハイフン・アンダースコアで入力してください。';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'パスワードは6文字以上で設定してください。';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'パスワードが一致しません。';
    return;
  }

  try {
    const result = await signUpWithUsername(username, password);
    if (!result.session) {
      errorEl.textContent = '登録は完了しましたが、自動ログインできませんでした。ログインタブからログインし直してください。';
      return;
    }
    // 会社設定の初期レコードを作成
    await supabaseClient.from('company_settings').upsert({ user_id: result.user.id });
    location.href = getNextPage();
  } catch (e) {
    errorEl.textContent = friendlyAuthError(e);
  }
});

// パスワード入力欄に添えた「表示」ボタンを、クリックのたびに入力内容の
// 表示・非表示を切り替えるボタンにする（common.jsを読み込んでいないため、
// この画面専用に定義する。account.html等ではcommon.jsの同名の関数を使用）
document.querySelectorAll('.password-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '表示' : '非表示';
    btn.setAttribute('aria-label', showing ? 'パスワードを表示' : 'パスワードを非表示');
  });
});

// 既にログイン済みならそのまま次のページへ
(async () => {
  const user = await getCurrentUser();
  if (user) location.href = getNextPage();
})();
