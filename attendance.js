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

function computeWorkedMinutes(rec, company) {
  if (!rec || rec.status === 'absence' || rec.status === 'paid_leave') return null;
  const inMin = roundClockInMinutes(timeToMinutes(rec.clockIn), company);
  const outMin = roundClockOutMinutes(timeToMinutes(rec.clockOut), company);
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

// 丸め後の出勤・退勤時刻（0時からの経過分）を時刻表示（HH:MM）にする。
// 24時（1440分）以上・0分未満に丸められた場合は日をまたいだ時刻として折り返す
function fmtClockTime(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 「法定外60内」の直後に「週残業」、「深夜」の直後に「週深夜残業時間」を挿入した表示順
const OVERTIME_MINUTE_COLUMNS_WITH_WEEKLY = (() => {
  const cols = OVERTIME_MINUTE_COLUMNS.slice();
  cols.splice(cols.indexOf('overtimeWithin60') + 1, 0, 'weeklyOvertime');
  cols.splice(cols.indexOf('lateNight') + 1, 0, 'weeklyOvertimeNight');
  return cols;
})();

// まだ記録のない日について、会社マスタ管理で設定した曜日に応じてステータスの
// 初期値を決める（法定休日を優先。既存の記録がある日はこれで上書きしない）
function defaultStatusForWeekday(dow, company) {
  if (dow === company.statutoryHolidayWeekday) return 'statutory_holiday_work';
  if (dow === company.scheduledHolidayWeekday) return 'scheduled_holiday_work';
  return 'normal';
}

// 見出し行を再掲する位置（0始まりのインデックス。この位置の行の直前に挿入する）を決める。
// 期間が暦月をまたぐ場合はその境目（例：15日締めなら月末日と翌月1日の間）、またがない
// 場合（末日締め）は期間の中間（例：31日間なら15日と16日の間）とする。
function computeMidHeaderInsertIndex(periodDates) {
  for (let i = 1; i < periodDates.length; i++) {
    if (periodDates[i].m !== periodDates[i - 1].m || periodDates[i].y !== periodDates[i - 1].y) {
      return i;
    }
  }
  return Math.floor(periodDates.length / 2);
}

function renderMonthTotalRow(rowId, totals) {
  const row = document.getElementById(rowId);
  OVERTIME_MINUTE_COLUMNS_WITH_WEEKLY.concat('worked').forEach((key) => {
    const cell = row.querySelector(`[data-role="${key}"]`);
    if (cell) cell.textContent = fmtHm(totals[key]);
  });
}

async function renderDayTable() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  const tbody = document.querySelector('#dayTable tbody');
  tbody.innerHTML = '';
  if (!employee || !ym) return;

  const company = await getCompany(employee.branchId);
  const [y, m] = ym.split('-').map(Number);
  const periodDates = buildPayPeriodDates(y, m, company.paycheckClosingDay);
  const first = periodDates[0];
  const last = periodDates[periodDates.length - 1];
  document.getElementById('periodRangeLabel').textContent =
    `※ 対象期間：${first.y}/${first.m}/${first.d} 〜 ${last.y}/${last.m}/${last.d}（会社マスタ管理の賃金締日に基づく）`;
  const records = await fetchPeriodRecords(employee.id, periodDates);
  const { perDay: overtimeByDay, monthTotals } = computeOvertimeCategoryBreakdown(records, periodDates.length, company);
  const weeklyByDay = await computeWeeklyOvertimeWithPadding(employee.id, periodDates, records, overtimeByDay, company.weekStartDay, company.weeklyOvertimeThreshold, company);
  const showMidHeader = document.getElementById('showMidHeaderCheckbox').checked;
  const midHeaderInsertAt = showMidHeader ? computeMidHeaderInsertIndex(periodDates) : -1;
  const headerRowTemplate = document.getElementById('dayTableHeaderRow');
  let workedTotal = 0;
  let weeklyOvertimeTotal = 0;
  let weeklyOvertimeNightTotal = 0;

  periodDates.forEach((date, i) => {
    if (i === midHeaderInsertAt) {
      const midHeader = headerRowTemplate.cloneNode(true);
      midHeader.removeAttribute('id');
      midHeader.classList.add('mid-header-row');
      tbody.appendChild(midHeader);
    }
    const idx = i + 1;
    const jsDate = new Date(date.y, date.m - 1, date.d);
    const dow = jsDate.getDay();
    const weekday = WEEKDAY_LABELS[dow];
    const rec = records[String(idx)] || { clockIn: '', clockOut: '', breakMinutes: 60, status: defaultStatusForWeekday(dow, company) };
    const scheduledStart = rec.scheduledStart || employee.workStart || '';
    const scheduledEnd = rec.scheduledEnd || employee.workEnd || '';
    const worked = computeWorkedMinutes(rec, company);
    workedTotal += worked || 0;
    // 丸め後の出勤・退勤時刻は、会社マスタ管理で丸め設定が有効な場合のみ表示する
    const roundedClockIn = company.roundingEnabled ? roundClockInMinutes(timeToMinutes(rec.clockIn), company) : null;
    const roundedClockOut = company.roundingEnabled ? roundClockOutMinutes(timeToMinutes(rec.clockOut), company) : null;
    weeklyOvertimeTotal += weeklyByDay[idx].weeklyOvertime;
    weeklyOvertimeNightTotal += weeklyByDay[idx].weeklyOvertimeNight;
    const dayValues = Object.assign({}, overtimeByDay[idx], weeklyByDay[idx]);
    const categoryCells = OVERTIME_MINUTE_COLUMNS_WITH_WEEKLY
      .map((key) => `<td class="computed" data-role="${key}">${fmtHm(dayValues[key])}</td>`)
      .join('');

    const tr = document.createElement('tr');
    tr.className = rec.status && rec.status !== 'normal' ? `row-${rec.status}` : '';
    const isTimeless = rec.status === 'absence' || rec.status === 'paid_leave';
    tr.innerHTML = `
      <td class="date-cell ${dow === 0 ? 'is-weekend' : ''} ${dow === 6 ? 'is-saturday' : ''}">${date.m}/${date.d} (${weekday})</td>
      <td>
        <select data-field="status">
          <option value="normal" ${rec.status === 'normal' ? 'selected' : ''}>通常</option>
          <option value="paid_leave" ${rec.status === 'paid_leave' ? 'selected' : ''}>有給休暇</option>
          <option value="absence" ${rec.status === 'absence' ? 'selected' : ''}>欠勤</option>
          <option value="scheduled_holiday_work" ${rec.status === 'scheduled_holiday_work' || rec.status === 'holiday_work' ? 'selected' : ''}>所定休日</option>
          <option value="statutory_holiday_work" ${rec.status === 'statutory_holiday_work' ? 'selected' : ''}>法定休日</option>
        </select>
      </td>
      <td><input type="time" data-field="clockIn" value="${rec.clockIn || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="clockOut" value="${rec.clockOut || ''}" ${isTimeless ? 'disabled' : ''}></td>
      <td class="computed" data-role="clockInRounded">${fmtClockTime(roundedClockIn)}</td>
      <td class="computed" data-role="clockOutRounded">${fmtClockTime(roundedClockOut)}</td>
      <td><input type="time" data-field="scheduledStart" value="${escapeHtml(scheduledStart)}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="time" data-field="scheduledEnd" value="${escapeHtml(scheduledEnd)}" ${isTimeless ? 'disabled' : ''}></td>
      <td><input type="number" min="0" step="5" data-field="breakMinutes" value="${rec.breakMinutes ?? 60}" ${isTimeless ? 'disabled' : ''}></td>
      <td class="computed" data-role="worked">${fmtHm(worked)}</td>
      ${categoryCells}
    `;
    tr.dataset.actualYm = ymKey(date.y, date.m);
    tr.dataset.actualDay = date.d;
    tbody.appendChild(tr);
  });

  const monthTotalsWithWeekly = Object.assign({ weeklyOvertime: weeklyOvertimeTotal, weeklyOvertimeNight: weeklyOvertimeNightTotal, worked: workedTotal }, monthTotals);
  renderMonthTotalRow('monthTotalTopRow', monthTotalsWithWeekly);
  renderMonthTotalRow('monthTotalBottomRow', monthTotalsWithWeekly);

  // 出勤・退勤の両方が入力されている（または時刻不要なステータスの）行のみ、
  // 変更のたびに自動保存する。片方の時刻しか入っていない途中段階では保存
  // しない。時刻欄はスマホのピッカー操作中にも'change'が発火しうるため、
  // ピッカーを閉じた（フォーカスが外れた）タイミングである'blur'で判定する
  // （'change'で判定すると、退勤時刻を選び終える前に保存されてしまう）。
  tbody.querySelectorAll('tr:not(.mid-header-row)').forEach((tr) => {
    const actualYm = tr.dataset.actualYm;
    const actualDay = tr.dataset.actualDay;
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
      if (isReadyToSave()) saveRow(employee, actualYm, actualDay, tr);
    });
    [clockInEl, clockOutEl, scheduledStartEl, scheduledEndEl].forEach((el) => {
      el.addEventListener('blur', () => { if (isReadyToSave()) saveRow(employee, actualYm, actualDay, tr); });
    });
    tr.querySelector('[data-field="breakMinutes"]').addEventListener('change', () => {
      if (isReadyToSave()) saveRow(employee, actualYm, actualDay, tr);
    });
  });
}

async function saveRow(employee, actualYm, actualDay, tr) {
  const status = tr.querySelector('[data-field="status"]').value;
  const record = {
    status,
    clockIn: tr.querySelector('[data-field="clockIn"]').value,
    clockOut: tr.querySelector('[data-field="clockOut"]').value,
    scheduledStart: tr.querySelector('[data-field="scheduledStart"]').value,
    scheduledEnd: tr.querySelector('[data-field="scheduledEnd"]').value,
    breakMinutes: Number(tr.querySelector('[data-field="breakMinutes"]').value) || 0,
  };
  await setDayAttendance(employee.id, actualYm, actualDay, record);
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
document.getElementById('showMidHeaderCheckbox').addEventListener('change', renderDayTable);

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
