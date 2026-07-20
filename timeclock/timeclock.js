// ============================================================================
// 勤怠打刻画面のロジック
// 出勤・退勤ボタンを押すと、その場でJST現在時刻を勤怠記録に反映する。
// 給与・勤怠管理システムと同一オリジンのlocalStorageを共有するため、
// ここで打刻した内容はそのまま勤怠管理画面・給与計算に連動する。
// ============================================================================

function currentEmployee() {
  const id = document.getElementById('employeeSelect').value;
  return id ? getEmployee(id) : null;
}

function populateEmployeeSelect() {
  const employees = listEmployees();
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

function renderTodayStatus() {
  const employee = currentEmployee();
  const tbody = document.querySelector('#todayTable tbody');
  tbody.innerHTML = '';
  if (!employee) return;

  const { ym, day } = todayParts();
  const rec = getMonthAttendance(employee.id, ym)[String(day)] || null;
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

function punch(kind) {
  const employee = currentEmployee();
  if (!employee) return;

  const { ym, day, hm } = todayParts();
  const existing = getMonthAttendance(employee.id, ym)[String(day)] || {
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
  setDayAttendance(employee.id, ym, day, record);

  const label = kind === 'in' ? '出勤' : '退勤';
  document.getElementById('punchStatus').innerHTML = `<strong>${escapeHtml(employee.name)}</strong> さん：${hm} に${label}を記録しました。`;
  renderTodayStatus();
}

document.getElementById('employeeSelect').addEventListener('change', renderTodayStatus);
document.getElementById('clockInBtn').addEventListener('click', () => punch('in'));
document.getElementById('clockOutBtn').addEventListener('click', () => punch('out'));

const hasEmployees = populateEmployeeSelect();
if (hasEmployees) {
  renderTodayStatus();
}
updateClockDisplay();
setInterval(updateClockDisplay, 1000);
