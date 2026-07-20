// ============================================================================
// 勤怠管理画面のロジック
// ============================================================================

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

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
  document.getElementById('attendanceContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

const OVERTIME_MINUTE_COLUMNS = OVERTIME_RATE_CATEGORIES.map((c) => overtimeMinuteKey(c.key));

function computeWorkedMinutes(rec) {
  if (!rec || rec.status === 'absence' || rec.status === 'paid_leave') return null;
  const inMin = timeToMinutes(rec.clockIn);
  const outMin = timeToMinutes(rec.clockOut);
  if (inMin === null || outMin === null) return null;
  const breakMin = Number(rec.breakMinutes) || 0;
  const rawEnd = outMin <= inMin ? outMin + 24 * 60 : outMin;
  return Math.max(0, (rawEnd - inMin) - breakMin);
}

function fmtHm(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

async function renderDayTable() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const tbody = document.querySelector('#dayTable tbody');
  tbody.innerHTML = '';
  if (!employee || !ym) return;

  const records = await getMonthAttendance(employee.id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const { perDay: overtimeByDay } = computeOvertimeCategoryBreakdown(records, daysInMonth);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m - 1, d);
    const weekday = WEEKDAY_LABELS[date.getDay()];
    const rec = records[String(d)] || { clockIn: '', clockOut: '', breakMinutes: 60, status: 'normal' };
    const scheduledStart = rec.scheduledStart || employee.workStart || '';
    const scheduledEnd = rec.scheduledEnd || employee.workEnd || '';
    const worked = computeWorkedMinutes(rec);
    const categoryCells = OVERTIME_MINUTE_COLUMNS
      .map((key) => `<td class="computed" data-role="${key}">${fmtHm(overtimeByDay[d][key])}</td>`)
      .join('');

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
          <option value="scheduled_holiday_work" ${rec.status === 'scheduled_holiday_work' || rec.status === 'holiday_work' ? 'selected' : ''}>所定休日出勤</option>
          <option value="statutory_holiday_work" ${rec.status === 'statutory_holiday_work' ? 'selected' : ''}>法定休日出勤</option>
        </select>
      </td>
      <td><input type="time" data-field="clockIn" value="${rec.clockIn || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="clockOut" value="${rec.clockOut || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="scheduledStart" value="${escapeHtml(scheduledStart)}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="scheduledEnd" value="${escapeHtml(scheduledEnd)}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="number" min="0" step="5" data-field="breakMinutes" value="${rec.breakMinutes ?? 60}" ${isTimeless ? 'disabled' : ''}></td>
      <td class="computed" data-role="worked">${fmtHm(worked)}</td>
      ${categoryCells}
    `;
    tr.dataset.day = d;
    tbody.appendChild(tr);
  }

  // 出勤・退勤の両方が入力されている（または時刻不要なステータスの）行のみ、
  // 変更のたびに自動保存する。片方の時刻しか入っていない途中段階では保存
  // しない。時刻欄はスマホのピッカー操作中にも'change'が発火しうるため、
  // ピッカーを閉じた（フォーカスが外れた）タイミングである'blur'で判定する
  // （'change'で判定すると、退勤時刻を選び終える前に保存されてしまう）。
  tbody.querySelectorAll('tr').forEach((tr) => {
    const day = tr.dataset.day;
    const statusSelect = tr.querySelector('[data-field="status"]');
    const clockInEl = tr.querySelector('[data-field="clockIn"]');
    const clockOutEl = tr.querySelector('[data-field="clockOut"]');
    const scheduledStartEl = tr.querySelector('[data-field="scheduledStart"]');
    const scheduledEndEl = tr.querySelector('[data-field="scheduledEnd"]');
    const isReadyToSave = () => {
      const timeless = statusSelect.value === 'absence' || statusSelect.value === 'paid_leave';
      return timeless || (clockInEl.value && clockOutEl.value);
    };
    statusSelect.addEventListener('change', () => {
      const timeless = statusSelect.value === 'absence' || statusSelect.value === 'paid_leave';
      tr.querySelectorAll('[data-field="clockIn"], [data-field="clockOut"], [data-field="scheduledStart"], [data-field="scheduledEnd"], [data-field="breakMinutes"]')
        .forEach((el) => { el.disabled = timeless; });
      if (isReadyToSave()) saveRow(employee, ym, day, tr);
    });
    [clockInEl, clockOutEl, scheduledStartEl, scheduledEndEl].forEach((el) => {
      el.addEventListener('blur', () => { if (isReadyToSave()) saveRow(employee, ym, day, tr); });
    });
    tr.querySelector('[data-field="breakMinutes"]').addEventListener('change', () => {
      if (isReadyToSave()) saveRow(employee, ym, day, tr);
    });
  });
}

async function saveRow(employee, ym, day, tr) {
  const status = tr.querySelector('[data-field="status"]').value;
  const record = {
    status,
    clockIn: tr.querySelector('[data-field="clockIn"]').value,
    clockOut: tr.querySelector('[data-field="clockOut"]').value,
    scheduledStart: tr.querySelector('[data-field="scheduledStart"]').value,
    scheduledEnd: tr.querySelector('[data-field="scheduledEnd"]').value,
    breakMinutes: Number(tr.querySelector('[data-field="breakMinutes"]').value) || 0,
  };
  await setDayAttendance(employee.id, ym, day, record);
  await renderDayTable();
  await renderSummary();
}

async function renderSummary() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const grid = document.getElementById('summaryGrid');
  if (!employee || !ym) { grid.innerHTML = ''; return; }

  const s = await computeMonthSummary(employee, ym);
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

async function refreshAll() {
  await renderDayTable();
  await renderSummary();
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const link = document.getElementById('goPayrollBtn');
  link.href = employee && ym ? `payroll.html?emp=${encodeURIComponent(employee.id)}&ym=${encodeURIComponent(ym)}` : 'payroll.html';
}

document.getElementById('employeeSelect').addEventListener('change', refreshAll);
document.getElementById('monthInput').addEventListener('change', refreshAll);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('attendance.html');
  renderNavbarUser(user);

  document.getElementById('monthInput').value = currentYmInputValue();
  const hasEmployees = await populateEmployeeSelect();

  const params = new URLSearchParams(location.search);
  if (hasEmployees) {
    if (params.get('emp') && await getEmployee(params.get('emp'))) {
      document.getElementById('employeeSelect').value = params.get('emp');
    }
    if (params.get('ym')) {
      document.getElementById('monthInput').value = params.get('ym');
    }
  }

  await refreshAll();
})();
