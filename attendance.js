// ============================================================================
// 勤怠管理画面のロジック
// ============================================================================

renderNavbar('attendance.html');

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

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
  document.getElementById('attendanceContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function computeDayDisplay(employee, rec) {
  if (!rec || rec.status === 'absence' || rec.status === 'paid_leave') return { worked: null, overtime: null };
  const inMin = timeToMinutes(rec.clockIn);
  const outMin = timeToMinutes(rec.clockOut);
  if (inMin === null || outMin === null) return { worked: null, overtime: null };
  const breakMin = Number(rec.breakMinutes) || 0;
  const worked = Math.max(0, outMin - inMin - breakMin);
  const standardDailyMinutes = (employee.standardDailyHours || 8) * 60;
  const overtime = rec.status === 'holiday_work' ? worked : Math.max(0, worked - standardDailyMinutes);
  return { worked, overtime };
}

function fmtHm(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function renderDayTable() {
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const tbody = document.querySelector('#dayTable tbody');
  tbody.innerHTML = '';
  if (!employee || !ym) return;

  const records = getMonthAttendance(employee.id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m - 1, d);
    const weekday = WEEKDAY_LABELS[date.getDay()];
    const rec = records[String(d)] || { clockIn: '', clockOut: '', breakMinutes: 60, status: 'normal' };
    const display = computeDayDisplay(employee, rec);

    const tr = document.createElement('tr');
    tr.className = rec.status && rec.status !== 'normal' ? `row-${rec.status}` : '';
    const isTimeless = rec.status === 'absence' || rec.status === 'paid_leave';
    tr.innerHTML = `
      <td class="date-cell ${date.getDay() === 0 ? 'is-weekend' : ''} ${date.getDay() === 6 ? 'is-saturday' : ''}">${m}/${d} (${weekday})</td>
      <td>
        <select data-field="status">
          <option value="normal" ${rec.status === 'normal' ? 'selected' : ''}>通常</option>
          <option value="paid_leave" ${rec.status === 'paid_leave' ? 'selected' : ''}>有給休暇</option>
          <option value="absence" ${rec.status === 'absence' ? 'selected' : ''}>欠勤</option>
          <option value="holiday_work" ${rec.status === 'holiday_work' ? 'selected' : ''}>休日出勤</option>
        </select>
      </td>
      <td><input type="time" data-field="clockIn" value="${rec.clockIn || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="clockOut" value="${rec.clockOut || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="number" min="0" step="5" data-field="breakMinutes" value="${rec.breakMinutes ?? 60}" ${isTimeless ? 'disabled' : ''}></td>
      <td class="computed" data-role="worked">${fmtHm(display.worked)}</td>
      <td class="computed" data-role="overtime">${fmtHm(display.overtime)}</td>
    `;
    tr.dataset.day = d;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('tr').forEach((tr) => {
    const day = tr.dataset.day;
    const onChange = () => saveRow(employee, ym, day, tr);
    tr.querySelectorAll('select, input').forEach((el) => el.addEventListener('change', onChange));
  });
}

function saveRow(employee, ym, day, tr) {
  const status = tr.querySelector('[data-field="status"]').value;
  const record = {
    status,
    clockIn: tr.querySelector('[data-field="clockIn"]').value,
    clockOut: tr.querySelector('[data-field="clockOut"]').value,
    breakMinutes: Number(tr.querySelector('[data-field="breakMinutes"]').value) || 0,
  };
  setDayAttendance(employee.id, ym, day, record);
  renderDayTable();
  renderSummary();
}

function renderSummary() {
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const grid = document.getElementById('summaryGrid');
  if (!employee || !ym) { grid.innerHTML = ''; return; }

  const s = computeMonthSummary(employee, ym);
  const tiles = [
    ['出勤日数', `${s.workDays} 日`, ''],
    ['実働時間 合計', `${s.workedHours.toFixed(1)} h`, ''],
    ['残業時間 合計', `${s.overtimeHours.toFixed(1)} h`, 'accent'],
    ['欠勤日数', `${s.absenceDays} 日`, s.absenceDays ? 'warn' : ''],
    ['有給休暇日数', `${s.paidLeaveDays} 日`, ''],
    ['休日出勤日数', `${s.holidayWorkDays} 日`, ''],
    ['遅刻回数', `${s.lateCount} 回`, s.lateCount ? 'warn' : ''],
    ['早退回数', `${s.earlyLeaveCount} 回`, s.earlyLeaveCount ? 'warn' : ''],
  ];
  grid.innerHTML = tiles.map(([label, value, cls]) => `
    <div class="summary-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value ${cls}">${value}</div>
    </div>
  `).join('');
}

function refreshAll() {
  renderDayTable();
  renderSummary();
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const link = document.getElementById('goPayrollBtn');
  link.href = employee && ym ? `payroll.html?emp=${encodeURIComponent(employee.id)}&ym=${encodeURIComponent(ym)}` : 'payroll.html';
}

document.getElementById('employeeSelect').addEventListener('change', refreshAll);
document.getElementById('monthInput').addEventListener('change', refreshAll);

document.getElementById('monthInput').value = currentYmInputValue();
const hasEmployees = populateEmployeeSelect();

const params = new URLSearchParams(location.search);
if (hasEmployees) {
  if (params.get('emp') && getEmployee(params.get('emp'))) {
    document.getElementById('employeeSelect').value = params.get('emp');
  }
  if (params.get('ym')) {
    document.getElementById('monthInput').value = params.get('ym');
  }
}

refreshAll();
