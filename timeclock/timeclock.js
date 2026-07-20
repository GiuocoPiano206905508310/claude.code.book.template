// ============================================================================
// 勤怠打刻画面のロジック
// 出勤・退勤ボタンを押すと、その場でJST現在時刻を勤怠記録に反映する。
// 給与・勤怠管理システムと同じSupabaseプロジェクト（同一会社アカウント）の
// データを共有するため、ここで打刻した内容はそのまま勤怠管理画面・
// 給与計算に連動する。
//
// この端末（ブラウザ）自体は、会社アカウント（給与・勤怠管理システムと同じ
// ログイン）で一度ログインしておく必要がある。日々の打刻では、その上に
// さらに従業員ごとの「勤怠打刻用ユーザーID・パスワード」でログインする
// （会社ログインとは別物・従業員マスタ管理で設定）。ログインしたブラウザの
// タブを閉じるとログアウトされ、次の人がログインし直せるようにしている。
// ============================================================================

const TIMECLOCK_SESSION_KEY = 'timeclockLoggedInEmployee';

let loggedInEmployeeId = null;

function getStoredEmployeeLogin() {
  try {
    const raw = sessionStorage.getItem(TIMECLOCK_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function storeEmployeeLogin(employee) {
  sessionStorage.setItem(TIMECLOCK_SESSION_KEY, JSON.stringify({ id: employee.id, name: employee.name }));
}

function clearEmployeeLogin() {
  sessionStorage.removeItem(TIMECLOCK_SESSION_KEY);
}

async function currentEmployee() {
  return loggedInEmployeeId ? await getEmployee(loggedInEmployeeId) : null;
}

function showLoginSection() {
  document.getElementById('employeeLoginSection').style.display = '';
  document.getElementById('clockContent').style.display = 'none';
  document.getElementById('loginEmpName').value = '';
  document.getElementById('loginEmpCode').value = '';
  document.getElementById('loginEmpPassword').value = '';
  document.getElementById('empLoginError').textContent = '';
}

async function enterAsEmployee(employee) {
  loggedInEmployeeId = employee.id;
  storeEmployeeLogin(employee);
  document.getElementById('employeeLoginSection').style.display = 'none';
  document.getElementById('clockContent').style.display = '';
  document.getElementById('loggedInEmpLabel').textContent = `${employee.name} さんとしてログイン中`;
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
  try {
    const employee = await getEmployeeByCode(code);
    const ok = employee && employee.loginPassword && employee.name.trim() === name && employee.loginPassword === password;
    if (!ok) {
      errorEl.textContent = '従業員名・ユーザーID・パスワードの組み合わせが正しくありません。';
      return;
    }
    await enterAsEmployee(employee);
  } catch (e) {
    errorEl.textContent = '通信に失敗しました。しばらくしてから再度お試しください。';
  }
}

function logoutEmployee() {
  loggedInEmployeeId = null;
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

function computeWorkedDisplay(employee, rec) {
  if (!rec || rec.status === 'absence' || rec.status === 'paid_leave') return null;
  const inMin = timeToMinutes(rec.clockIn);
  const outMin = timeToMinutes(rec.clockOut);
  if (inMin === null || outMin === null) return null;
  const breakMin = Number(rec.breakMinutes) || 0;
  const worked = Math.max(0, outMin - inMin - breakMin);
  return `${Math.floor(worked / 60)}時間${worked % 60}分`;
}

async function renderTodayStatus() {
  const employee = await currentEmployee();
  const tbody = document.querySelector('#todayTable tbody');
  tbody.innerHTML = '';
  if (!employee) return;

  const { ym, day } = todayParts();
  const records = await getMonthAttendance(employee.id, ym);
  const rec = records[String(day)] || null;
  const worked = computeWorkedDisplay(employee, rec);

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
  const employee = await currentEmployee();
  if (!employee) return;

  const label = kind === 'in' ? '出勤' : '退勤';
  const statusEl = document.getElementById('punchStatus');
  try {
    const { ym, day, hm } = todayParts();
    const records = await getMonthAttendance(employee.id, ym);
    const existing = records[String(day)] || {
      status: 'normal', clockIn: '', clockOut: '', breakMinutes: 60,
    };
    // 欠勤・有給休暇として記録されていた日に打刻した場合は、出勤扱いに戻す
    const status = (existing.status === 'absence' || existing.status === 'paid_leave') ? 'normal' : existing.status;
    const record = Object.assign({}, existing, { status });
    if (kind === 'in') {
      record.clockIn = hm;
    } else {
      record.clockOut = hm;
    }
    await setDayAttendance(employee.id, ym, day, record);

    statusEl.innerHTML = `<strong>${escapeHtml(employee.name)}</strong> さん：${hm} に${label}を記録しました。`;
    await renderTodayStatus();
  } catch (e) {
    statusEl.innerHTML = `<span style="color:#e57373;">${label}の記録に失敗しました。通信状況を確認し、もう一度お試しください。</span>`;
  }
}

document.getElementById('empLoginBtn').addEventListener('click', tryEmployeeLogin);
document.getElementById('empLogoutLink').addEventListener('click', (e) => { e.preventDefault(); logoutEmployee(); });
document.getElementById('clockInBtn').addEventListener('click', () => punch('in'));
document.getElementById('clockOutBtn').addEventListener('click', () => punch('out'));

(async () => {
  const user = await requireAuth('../login.html', 'timeclock/index.html');
  if (!user) return;
  renderNavbarUser(user);

  // 時計表示は通信状況に関わらず即座に動かし始める
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);

  try {
    const hasEmployees = await hasAnyEmployees();
    document.getElementById('noEmployeeState').style.display = hasEmployees ? 'none' : '';
    if (!hasEmployees) return;

    const stored = getStoredEmployeeLogin();
    if (stored) {
      const employee = await getEmployee(stored.id);
      if (employee) {
        await enterAsEmployee(employee);
        return;
      }
      clearEmployeeLogin();
    }
    showLoginSection();
  } catch (e) {
    document.getElementById('punchStatus').innerHTML =
      '<span style="color:#e57373;">読み込みに失敗しました。通信状況を確認し、画面を再読み込みしてください。</span>';
  }
})();
