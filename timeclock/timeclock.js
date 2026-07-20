// ============================================================================
// 勤怠打刻画面のロジック
// 出勤・退勤ボタンを押すと、その場でJST現在時刻を勤怠記録に反映する。
// 給与・勤怠管理システムと同じSupabaseプロジェクト（同一会社アカウント）の
// データを共有するため、ここで打刻した内容はそのまま勤怠管理画面・
// 給与計算に連動する。この端末で先に給与・勤怠管理システムにログインして
// おく必要がある（セッションは同一オリジンで共有される）。
// ============================================================================

async function currentEmployee() {
  const id = document.getElementById('employeeSelect').value;
  return id ? await getEmployee(id) : null;
}

async function populateEmployeeSelect() {
  const employees = await listEmployees();
  const select = document.getElementById('employeeSelect');
  select.innerHTML = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  const hasEmployees = employees.length > 0;
  document.getElementById('noEmployeeState').style.display = hasEmployees ? 'none' : '';
  document.getElementById('clockContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
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

document.getElementById('employeeSelect').addEventListener('change', renderTodayStatus);
document.getElementById('clockInBtn').addEventListener('click', () => punch('in'));
document.getElementById('clockOutBtn').addEventListener('click', () => punch('out'));

(async () => {
  const user = await requireAuth('../login.html', 'timeclock/index.html');
  if (!user) return;
  renderNavbarUser(user);

  // 時計表示は従業員一覧・勤怠データの通信状況に関わらず即座に動かし始める
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);

  try {
    const hasEmployees = await populateEmployeeSelect();
    if (hasEmployees) {
      await renderTodayStatus();
    }
  } catch (e) {
    document.getElementById('punchStatus').innerHTML =
      '<span style="color:#e57373;">従業員情報の読み込みに失敗しました。通信状況を確認し、画面を再読み込みしてください。</span>';
  }
})();
