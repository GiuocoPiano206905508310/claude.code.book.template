// ============================================================================
// アカウント設定画面のロジック（パスワード変更・画面の表示設定）
// ============================================================================

let loggedInUser = null;

function friendlyPasswordError(error) {
  const msg = (error && error.message) || '';
  if (msg.includes('Invalid login credentials')) return '現在のパスワードが正しくありません。';
  if (msg.includes('Password should be at least')) return 'パスワードは6文字以上で設定してください。';
  if (msg.includes('should be different')) return '現在のパスワードとは異なるパスワードを設定してください。';
  if (msg.includes('Failed to fetch')) return '通信に失敗しました。しばらくしてから再度お試しください。';
  return 'エラーが発生しました：' + msg;
}

document.getElementById('changePasswordBtn').addEventListener('click', async () => {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('newPasswordConfirm').value;

  if (!currentPassword) {
    showExportStatus('passwordStatus', '現在のパスワードを入力してください。', true);
    return;
  }
  if (newPassword.length < 6) {
    showExportStatus('passwordStatus', 'パスワードは6文字以上で設定してください。', true);
    return;
  }
  if (newPassword !== confirmPassword) {
    showExportStatus('passwordStatus', 'パスワードが一致しません。', true);
    return;
  }

  const btn = document.getElementById('changePasswordBtn');
  btn.disabled = true;
  try {
    // 現在のパスワードが正しいことを、再ログインを試みて確認してから変更する
    await signInWithUsername(currentUsername(loggedInUser), currentPassword);
    await changePassword(newPassword);
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPasswordConfirm').value = '';
    showExportStatus('passwordStatus', 'パスワードを変更しました。', false);
  } catch (e) {
    showExportStatus('passwordStatus', friendlyPasswordError(e), true);
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll('input[name="themeChoice"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) setThemePreference(radio.value);
  });
});

(async () => {
  const user = await requireAuth();
  if (!user) return;
  loggedInUser = user;
  renderNavbar('account.html');
  renderNavbarUser(user);

  const current = getThemePreference();
  const target = document.querySelector(`input[name="themeChoice"][value="${current}"]`);
  if (target) target.checked = true;
})();
