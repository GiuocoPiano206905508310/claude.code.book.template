// ============================================================================
// 有給休暇管理簿画面のロジック
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
  document.getElementById('leaveContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function paidLeaveGrantTypeLabel(weeklyScheduledDays, standardDailyHours) {
  const days = Number(weeklyScheduledDays) || 5;
  const weeklyHours = (Number(standardDailyHours) || 0) * days;
  return (days >= 1 && days <= 4 && weeklyHours < 30) ? `比例付与（週${days}日）` : '通常';
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function renderLedger() {
  const employee = await currentEmployee();
  document.getElementById('currentCycleCard').style.display = 'none';
  document.getElementById('ledgerCard').style.display = 'none';
  document.getElementById('noHireDateState').style.display = 'none';
  document.getElementById('notYetGrantedState').style.display = 'none';
  document.querySelector('#ledgerTable tbody').innerHTML = '';
  if (!employee) return;

  renderInfoTiles('employeeInfoGrid', [
    ['雇用形態', employee.employmentType],
    ['入社日', employee.hireDate || '未設定'],
    ['週の所定労働日数', `${employee.weeklyScheduledDays || 5} 日`],
    ['1日の所定労働時間', `${employee.standardDailyHours} 時間`],
    ['付与区分', paidLeaveGrantTypeLabel(employee.weeklyScheduledDays, employee.standardDailyHours)],
  ]);

  if (!employee.hireDate) {
    document.getElementById('noHireDateState').style.display = '';
    return;
  }

  const today = getJstNow();
  const schedule = calcPaidLeaveGrantSchedule(employee.hireDate, today);
  if (!schedule.length) {
    const [hy, hm, hd] = employee.hireDate.split('-').map(Number);
    const firstGrant = new Date(hy, hm - 1 + 6, hd);
    document.getElementById('notYetGrantedState').textContent =
      `入社から6か月未満のため、まだ年次有給休暇は付与されていません（初回の基準日：${formatDateYmd(firstGrant)}）。`;
    document.getElementById('notYetGrantedState').style.display = '';
    return;
  }

  const rows = [];
  let carryIn = 0;
  for (let i = 0; i < schedule.length; i++) {
    const { grantDate, continuousYears } = schedule[i];
    const grantDays = calcPaidLeaveGrantDays(employee.weeklyScheduledDays, employee.standardDailyHours, continuousYears);
    const nextGrantDate = new Date(grantDate.getFullYear() + 1, grantDate.getMonth(), grantDate.getDate());
    const legalCycleEnd = new Date(nextGrantDate.getTime() - ONE_DAY_MS);
    const searchEnd = legalCycleEnd < today ? legalCycleEnd : today;
    // eslint-disable-next-line no-await-in-loop
    const takenDays = await countPaidLeaveDaysBetween(employee.id, formatDateYmd(grantDate), formatDateYmd(searchEnd));

    // 取得日数は繰越分（前年度付与、時効直前）から先に消化したものとして扱う。
    // 繰越分の未消化分はここで時効消滅し、当年度新規付与分の残りのみ翌年度へ繰り越す。
    const consumedFromCarryIn = Math.min(takenDays, carryIn);
    const consumedFromGrant = Math.max(0, takenDays - consumedFromCarryIn);
    const remainingFromCarryIn = Math.max(0, carryIn - consumedFromCarryIn);
    const remainingFromGrant = Math.max(0, grantDays - consumedFromGrant);
    const remainingDays = remainingFromCarryIn + remainingFromGrant;
    const carryOut = remainingFromGrant;

    const isCurrent = i === schedule.length - 1;
    const yearIndex = paidLeaveYearIndex(continuousYears);
    const requiresFiveDays = grantDays >= 10;
    const fiveDayOk = !requiresFiveDays || takenDays >= 5;

    rows.push({
      grantDate, yearLabel: PAID_LEAVE_YEAR_LABELS[yearIndex],
      grantType: paidLeaveGrantTypeLabel(employee.weeklyScheduledDays, employee.standardDailyHours),
      carryIn, grantDays, takenDays, remainingDays, carryOut, legalCycleEnd, isCurrent, requiresFiveDays, fiveDayOk,
    });

    carryIn = carryOut;
  }

  const tbody = document.querySelector('#ledgerTable tbody');
  tbody.innerHTML = rows.map((r) => `
    <tr class="${r.isCurrent ? 'total' : ''}">
      <td>${formatDateYmd(r.grantDate)}${r.isCurrent ? '（現在）' : ''}</td>
      <td>${r.yearLabel}</td>
      <td>${r.grantType}</td>
      <td class="num">${r.carryIn.toFixed(1)} 日</td>
      <td class="num">${r.grantDays} 日</td>
      <td class="num">${r.takenDays.toFixed(1)} 日</td>
      <td class="num">${r.remainingDays.toFixed(1)} 日</td>
      <td class="num">${r.carryOut.toFixed(1)} 日</td>
      <td>${formatDateYmd(r.legalCycleEnd)}</td>
      <td>${r.requiresFiveDays ? (r.fiveDayOk ? '達成' : `未達成（あと${(5 - r.takenDays).toFixed(1)}日）`) : '対象外（10日未満）'}</td>
    </tr>
  `).join('');
  document.getElementById('ledgerCard').style.display = '';

  const current = rows[rows.length - 1];
  document.getElementById('currentCycleCard').style.display = '';
  renderInfoTiles('currentCycleGrid', [
    ['基準日', formatDateYmd(current.grantDate)],
    ['利用可能日数（繰越＋本年度付与）', `${(current.grantDays + current.carryIn).toFixed(1)} 日`],
    ['取得日数', `${current.takenDays.toFixed(1)} 日`],
    ['残日数', `${current.remainingDays.toFixed(1)} 日`],
    ['翌年度繰越の期限（次回基準日前日）', formatDateYmd(current.legalCycleEnd)],
  ]);
  const daysLeft = Math.ceil((current.legalCycleEnd - today) / ONE_DAY_MS);
  document.getElementById('fiveDayComplianceNote').textContent = !current.requiresFiveDays
    ? '本年度の付与日数が10日未満のため、年5日取得義務の対象外です。'
    : current.fiveDayOk
      ? `年5日取得義務は達成済みです（本年度の取得日数 ${current.takenDays.toFixed(1)} 日）。`
      : `年5日取得義務まで、あと ${(5 - current.takenDays).toFixed(1)} 日の取得が必要です（期限：${formatDateYmd(current.legalCycleEnd)}、残り ${daysLeft} 日）。`;
}

document.getElementById('employeeSelect').addEventListener('change', renderLedger);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('leave.html');
  renderNavbarUser(user);

  const hasEmployees = await populateEmployeeSelect();
  if (hasEmployees) await renderLedger();
})();
