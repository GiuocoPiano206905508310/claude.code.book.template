// ============================================================================
// 勤怠打刻画面のロジック
// 出勤・退勤ボタンを押すと、その場でJST現在時刻を勤怠記録に反映する。
// 給与・勤怠管理システムと同じSupabaseプロジェクトのデータを共有するため、
// ここで打刻した内容はそのまま勤怠管理画面・給与計算に連動する。
//
// この画面は会社アカウントでのログインを必要としない。従業員ごとの
// 「氏名・勤怠打刻用ユーザーID・パスワード」（従業員マスタ管理で設定）だけで
// 打刻できる。データベースへの読み書きは、認証情報が一致した場合のみ動作する
// データベース側の関数（timeclockEmployeeLogin / timeclockGetDay /
// timeclockPunch）経由で行うため、テーブルそのものは未ログインユーザーに
// 公開していない。
// ログインしたブラウザのタブを閉じるとログアウトされ、次の人がログインし直せる。
// ============================================================================

const TIMECLOCK_SESSION_KEY = 'timeclockLoggedInEmployee';

// 打刻のたびに従業員本人の認証情報でデータベース側の関数を呼ぶため、
// ログイン中はこの端末のタブ内（sessionStorage）にのみ保持する
let loggedInEmployee = null;

function getStoredEmployeeLogin() {
  try {
    const raw = sessionStorage.getItem(TIMECLOCK_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function storeEmployeeLogin(emp) {
  sessionStorage.setItem(TIMECLOCK_SESSION_KEY, JSON.stringify(emp));
}

function clearEmployeeLogin() {
  sessionStorage.removeItem(TIMECLOCK_SESSION_KEY);
}

function showLoginSection() {
  document.getElementById('employeeLoginSection').style.display = '';
  document.getElementById('clockContent').style.display = 'none';
  document.getElementById('loginEmpName').value = '';
  document.getElementById('loginEmpCode').value = '';
  document.getElementById('loginEmpPassword').value = '';
  document.getElementById('empLoginError').textContent = '';
}

async function enterAsEmployee(emp) {
  loggedInEmployee = emp;
  storeEmployeeLogin(emp);
  document.getElementById('employeeLoginSection').style.display = 'none';
  document.getElementById('clockContent').style.display = '';
  document.getElementById('loggedInEmpLabel').textContent = `${emp.name} さんとしてログイン中`;
  await renderTodayStatus();
}

async function tryEmployeeLogin() {
  const name = document.getElementById('loginEmpName').value.trim();
  const code = document.getElementById('loginEmpCode').value.trim();
  const password = document.getElementById('loginEmpPassword').value;
  const errorEl = document.getElementById('empLoginError');
  errorEl.textContent = '';

  if (!name || !code || !password) {
    errorEl.textContent = '従業員名・ユーザーID・パスワードをすべて入力してください。';
    return;
  }
  const btn = document.getElementById('empLoginBtn');
  btn.disabled = true;
  try {
    const found = await timeclockEmployeeLogin(name, code, password);
    if (!found) {
      errorEl.textContent = '従業員名・ユーザーID・パスワードの組み合わせが正しくありません。';
      return;
    }
    await enterAsEmployee({ id: found.employee_id, name: found.employee_name, code, password });
  } catch (e) {
    errorEl.textContent = '通信に失敗しました。しばらくしてから再度お試しください。';
  } finally {
    btn.disabled = false;
  }
}

function logoutEmployee() {
  loggedInEmployee = null;
  clearEmployeeLogin();
  document.getElementById('punchStatus').innerHTML = '';
  showLoginSection();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayParts() {
  const now = getJstNow();
  return {
    now,
    ym: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`,
    day: now.getDate(),
    hm: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  };
}

function updateClockDisplay() {
  const now = getJstNow();
  document.getElementById('clockDisplay').textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  document.getElementById('dateLabel').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${['日', '月', '火', '水', '木', '金', '土'][now.getDay()]}）日本時間`;
}

function computeWorkedDisplay(rec) {
  if (!rec || rec.status === 'absence' || rec.status === 'paid_leave') return null;
  const inMin = timeToMinutes(rec.clockIn);
  const outMin = timeToMinutes(rec.clockOut);
  if (inMin === null || outMin === null) return null;
  const breakMin = Number(rec.breakMinutes) || 0;
  const worked = Math.max(0, outMin - inMin - breakMin);
  return `${Math.floor(worked / 60)}時間${worked % 60}分`;
}

async function renderTodayStatus() {
  const tbody = document.querySelector('#todayTable tbody');
  tbody.innerHTML = '';
  if (!loggedInEmployee) return;

  const { ym, day } = todayParts();
  const rec = await timeclockGetDay(loggedInEmployee.code, loggedInEmployee.password, ym, day);
  const worked = computeWorkedDisplay(rec);

  const rows = [
    ['出勤時刻', rec && rec.clockIn ? rec.clockIn : '未打刻'],
    ['退勤時刻', rec && rec.clockOut ? rec.clockOut : '未打刻'],
    ['実働時間', worked || '—'],
  ];
  for (const [label, value] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="label">${label}</td><td class="value">${escapeHtml(value)}</td>`;
    tbody.appendChild(tr);
  }
}

async function punch(kind) {
  if (!loggedInEmployee) return;

  const label = kind === 'in' ? '出勤' : '退勤';
  const statusEl = document.getElementById('punchStatus');
  try {
    const { ym, day, hm } = todayParts();
    await timeclockPunch(loggedInEmployee.code, loggedInEmployee.password, ym, day, kind, hm);
    statusEl.innerHTML = `<strong>${escapeHtml(loggedInEmployee.name)}</strong> さん：${hm} に${label}を記録しました。`;
    await renderTodayStatus();
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#e57373;">${label}の記録に失敗しました。通信状況を確認し、もう一度お試しください。</span>`;
  }
}

document.getElementById('empLoginBtn').addEventListener('click', tryEmployeeLogin);
document.getElementById('loginEmpPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryEmployeeLogin();
});
document.getElementById('empLogoutLink').addEventListener('click', (e) => { e.preventDefault(); logoutEmployee(); });
document.getElementById('clockInBtn').addEventListener('click', () => punch('in'));
document.getElementById('clockOutBtn').addEventListener('click', () => punch('out'));

// 勤怠打刻（共用端末での利用を想定）から給与・勤怠管理システムへ移動する際は、
// 会社アカウントとしてログイン済みであっても再ログインを求める（打刻端末に
// 会社アカウントのログイン状態が残ったまま、誰でも管理画面に入れてしまう
// ことを防ぐため）
async function goToPayrollSystemWithReLogin(e, targetPath) {
  e.preventDefault();
  try { await signOut(); } catch (err) { /* サインアウトに失敗しても遷移は続行する */ }
  location.href = `../payroll-system/login.html?next=${encodeURIComponent(targetPath)}`;
}
document.getElementById('goToPayrollSystemLink').addEventListener('click', (e) => goToPayrollSystemWithReLogin(e, 'index.html'));

initPasswordToggles();

(async () => {
  // 時計表示は通信状況・ログイン状態に関わらず即座に動かし始める
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);

  // 同じタブでログイン済みなら打刻画面へ復帰、そうでなければ従業員ログインを表示
  const stored = getStoredEmployeeLogin();
  if (stored && stored.code && stored.password) {
    try {
      const found = await timeclockEmployeeLogin(stored.name, stored.code, stored.password);
      if (found) {
        await enterAsEmployee({ id: found.employee_id, name: found.employee_name, code: stored.code, password: stored.password });
        return;
      }
    } catch (e) { /* 通信不良時はログイン画面に戻す */ }
    clearEmployeeLogin();
  }
  showLoginSection();
})();
