// ============================================================================
// 給与計算画面のロジック
// ============================================================================

let currentAttendanceSummary = null;
let currentAutoOvertimePay = 0;
// 割増手当の区分別内訳（{key, label, hours, pay}の配列）。固定残業代の対象区分は
// 超過分のみ、対象外の区分は実績の全額を計上する（固定残業代が無効の場合は全区分が全額）
let currentOvertimeBreakdown = [];
// 従業員マスタ管理（保存済み明細を表示中の場合はその当時の値）から取り込む、
// 給与計算画面では編集不可の項目
let currentEmployeeFields = null;
// 会社マスタ管理（保存済み明細を表示中の場合はその当時の値）から取り込む、
// 給与計算画面では編集不可の項目
let currentCompanyFields = null;
// 固定残業代（みなし残業代）。保存済み明細を表示中の場合はその当時の値、
// 新規計算の場合は従業員マスタの設定と当月の勤怠集計から算出する
let currentFixedOvertime = null;

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
  document.getElementById('payrollContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function renderEmployeeInfoGrid(fields) {
  renderInfoTiles('employeeInfoGrid', [
    ['雇用形態', fields.employmentType],
    ['年齢区分', AGE_GROUP_LABELS[fields.ageGroup] || fields.ageGroup],
    [fields.employmentType === '役員' ? '役員報酬' : '基本給', `${formatThousands(fields.baseSalary)} 円`],
    ['その他手当（課税）', `${formatThousands(fields.taxableAllowance)} 円`],
    ['通勤手当（非課税）', `${formatThousands(fields.commuteAllowance)} 円`],
    ['扶養親族等の数', `${fields.dependents} 人`],
    ['甲欄・乙欄', fields.taxTable === '甲' ? '甲欄' : '乙欄'],
  ]);
}

function renderFixedOvertimeCard(fo) {
  document.getElementById('fixedOvertimeCard').style.display = fo.enabled ? '' : 'none';
  if (!fo.enabled) return;
  document.getElementById('fixedOvertimeCardTitle').textContent =
    fo.allowanceName ? `固定残業代（${fo.allowanceName}）` : '固定残業代（みなし残業代）';
  document.getElementById('fixedOvertimeNameDisplay').textContent = fo.allowanceName || '—';
  document.getElementById('fixedOvertimeHoursDisplay').textContent = `${fo.monthlyHours} 時間`;
  document.getElementById('fixedOvertimeAmountDisplay').textContent = `${formatThousands(fo.fixedPay)} 円`;
}

function renderCompanyInfoGrid(fields) {
  renderInfoTiles('companyInfoGrid', [
    ['源泉所得税の計算方法', fields.calcMethod === 'machine' ? '機械計算（甲欄のみ）' : '月額表'],
    ['健康保険の種類', fields.healthInsuranceType === 'kumiai' ? '健康保険組合' : '協会けんぽ'],
    ['都道府県（協会けんぽ支部）', fields.prefecture],
    ['健康保険料率', `${(fields.healthRate * 100).toFixed(2)} %`],
    ['介護保険料率', `${(fields.careRate * 100).toFixed(2)} %`],
    ['厚生年金保険料率', `${(fields.pensionRate * 100).toFixed(2)} %`],
    ['事業の種類（雇用保険）', fields.industryType],
    ['雇用保険料率（従業員負担分）', `${(fields.employmentRate * 100).toFixed(2)} %`],
  ]);
}

// 従業員マスタ・勤怠集計をもとに、フォームへ初期値を流し込む
async function loadFormForEmployeeMonth() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;

  const company = await getCompany();
  currentAttendanceSummary = await computeMonthSummary(employee, ym, company);
  const commuteAllowanceForOvertimeBase = employee.commuteAllowanceExcludeFromOvertimeBase === false ? (employee.commuteAllowance || 0) : 0;
  const overtimeBaseWage = employee.baseSalary + sumNonExcludedAllowances(employee.allowances) + commuteAllowanceForOvertimeBase;
  const hourlyWage = calcHourlyWage(overtimeBaseWage, employee.monthlyStandardHours);
  const absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
  const employeeAgeGroup = ageGroupFromAge(calcAge(employee.birthDate));

  const saved = await getPayslip(employee.id, ym);
  const input = saved ? saved.input : null;

  currentEmployeeFields = {
    employmentType: input ? input.employmentType : employee.employmentType,
    ageGroup: input ? input.ageGroup : employeeAgeGroup,
    baseSalary: input ? input.baseSalary : employee.baseSalary,
    taxableAllowance: input ? input.taxableAllowance : sumAllowances(employee.allowances),
    commuteAllowance: input ? input.commuteAllowance : employee.commuteAllowance,
    dependents: input ? input.dependents : employee.dependents,
    taxTable: input ? input.taxTable : employee.taxTable,
    employmentInsuranceExcludedAllowance: input
      ? (input.employmentInsuranceExcludedAllowance || 0)
      : sumExcludedFromEmploymentInsurance(employee.allowances),
  };
  renderEmployeeInfoGrid(currentEmployeeFields);

  const residentTaxInput = document.getElementById('residentTax');
  if (input) {
    residentTaxInput.value = formatThousands(input.residentTax || 0);
    document.getElementById('residentTaxNote').textContent = '';
  } else {
    const prevSlip = await getPayslip(employee.id, previousYm(ym));
    if (prevSlip) {
      residentTaxInput.value = formatThousands(prevSlip.input.residentTax || 0);
      document.getElementById('residentTaxNote').textContent =
        `前月（${ymLabel(previousYm(ym))}）の住民税額を自動反映しています。変更がある場合は編集してください。`;
    } else {
      residentTaxInput.value = formatThousands(0);
      document.getElementById('residentTaxNote').textContent = '';
    }
  }

  currentCompanyFields = {
    calcMethod: input ? input.calcMethod : company.calcMethod,
    healthRate: input ? input.healthRate : Number(company.healthRate) / 100,
    careRate: input ? input.careRate : Number(company.careRate) / 100,
    pensionRate: input ? input.pensionRate : Number(company.pensionRate) / 100,
    employmentRate: input ? input.employmentRate : Number(company.employmentRate) / 100,
    healthInsuranceType: company.healthInsuranceType,
    prefecture: company.prefecture,
    industryType: company.industryType,
  };
  renderCompanyInfoGrid(currentCompanyFields);

  if (input && input.fixedOvertimeEnabled !== undefined) {
    currentFixedOvertime = {
      enabled: !!input.fixedOvertimeEnabled,
      allowanceName: input.fixedOvertimeAllowanceName || '',
      monthlyHours: input.fixedOvertimeMonthlyHours || 0,
      fixedPay: input.fixedOvertimePay || 0,
    };
  } else if (employee.fixedOvertimeEnabled) {
    currentFixedOvertime = {
      enabled: true,
      allowanceName: employee.fixedOvertimeAllowanceName,
      monthlyHours: employee.fixedOvertimeMonthlyHours,
      fixedPay: employee.fixedOvertimeAmount,
    };
  } else {
    currentFixedOvertime = { enabled: false, allowanceName: '', monthlyHours: 0, fixedPay: 0 };
  }
  renderFixedOvertimeCard(currentFixedOvertime);

  currentOvertimeBreakdown = (input && input.overtimeBreakdown) ? input.overtimeBreakdown : calcOvertimeBreakdown(
    hourlyWage, employee, currentAttendanceSummary.overtimeCategoryMonthTotals,
    !!employee.fixedOvertimeEnabled, employee.fixedOvertimeMonthlyHours, employee.fixedOvertimeBaseCategories
  ).items;
  currentAutoOvertimePay = currentOvertimeBreakdown.reduce((sum, it) => sum + it.pay, 0);

  const overtimePayInput = document.getElementById('overtimePay');
  overtimePayInput.disabled = false;
  overtimePayInput.value = formatThousands(input ? input.overtimePay : currentAutoOvertimePay);
  document.getElementById('overtimeNote').textContent = currentFixedOvertime.enabled
    ? `勤怠集計に基づく自動計算額 ${formatThousands(currentAutoOvertimePay)} 円（固定残業代の対象区分は超過分のみ、対象外の区分は実績の全額を計上。内訳は下部の給与明細でご確認いただけます。編集可）`
    : `勤怠集計に基づく自動計算額 ${formatThousands(currentAutoOvertimePay)} 円（内訳は下部の給与明細でご確認いただけます。編集可）`;
  document.getElementById('applyAbsenceDeduction').checked = input ? !!input.applyAbsenceDeduction : currentAttendanceSummary.absenceDays > 0;

  document.getElementById('absenceDeductionPreview').textContent = `${formatThousands(absenceDeduction)} 円 / 欠勤 ${currentAttendanceSummary.absenceDays} 日`;

  renderAttendanceSummaryTiles(currentAttendanceSummary);

  if (saved) {
    renderResult(saved.result);
  } else {
    document.querySelector('#resultTable tbody').innerHTML = '';
    document.getElementById('netValue').textContent = '— 円';
  }
}

function renderAttendanceSummaryTiles(s) {
  const tiles = [
    ['実働時間', `${s.workedHours.toFixed(1)} h`, ''],
    ['残業時間', `${s.overtimeHours.toFixed(1)} h`, 'accent'],
    ['欠勤日数', `${s.absenceDays} 日`, s.absenceDays ? 'warn' : ''],
    ['有給休暇日数', `${s.paidLeaveDays} 日`, ''],
  ];
  document.getElementById('attendanceSummaryGrid').innerHTML = tiles.map(([label, value, cls]) => `
    <div class="summary-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value ${cls}">${value}</div>
    </div>
  `).join('');
  renderOvertimeBreakdownTiles(s);
}

// 「残業時間」の内訳（日次勤怠入力の割増区分別の当月合計）
const OVERTIME_BREAKDOWN_TILE_KEYS = [
  ['overtimeWithin60', '法定外60内'],
  ['overtimeOver60', '法定外60超'],
  ['weeklyOvertime', '週残業'],
  ['statutoryHoliday', '法定休日'],
  ['lateNight', '深夜'],
  ['weeklyOvertimeNight', '週深夜残業時間'],
  ['overtimeWithin60Night', '法定外60内+深夜'],
  ['overtimeOver60Night', '法定外60超+深夜'],
  ['statutoryHolidayNight', '法定休日+深夜'],
];

function renderOvertimeBreakdownTiles(s) {
  const totals = s.overtimeCategoryMonthTotals || {};
  document.getElementById('overtimeBreakdownGrid').innerHTML = OVERTIME_BREAKDOWN_TILE_KEYS.map(([key, label]) => `
    <div class="summary-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value">${((totals[key] || 0) / 60).toFixed(1)} h</div>
    </div>
  `).join('');
}

function collectInput() {
  return {
    ...currentEmployeeFields,
    ...currentCompanyFields,
    overtimePay: getNumInputValue('overtimePay'),
    residentTax: getNumInputValue('residentTax'),
    applyAbsenceDeduction: document.getElementById('applyAbsenceDeduction').checked,
    fixedOvertimeEnabled: currentFixedOvertime.enabled,
    fixedOvertimeAllowanceName: currentFixedOvertime.allowanceName,
    fixedOvertimeMonthlyHours: currentFixedOvertime.monthlyHours,
    fixedOvertimePay: currentFixedOvertime.fixedPay,
    overtimeBreakdown: currentOvertimeBreakdown,
  };
}

async function calculate() {
  const input = collectInput();
  const result = calculateMonthlyPayroll(input);
  result.overtimeBreakdown = input.overtimeBreakdown;

  const employee = await currentEmployee();
  result.absenceDeduction = 0;
  if (input.applyAbsenceDeduction && employee && currentAttendanceSummary) {
    result.absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
    result.netPay -= result.absenceDeduction;
  }

  renderResult(result);
  return { input, result };
}

function renderResult(r) {
  const isOfficer = currentEmployeeFields && currentEmployeeFields.employmentType === '役員';
  const rows = [
    [isOfficer ? '役員報酬' : '基本給', r.baseSalary, 'plain', true],
  ];
  if (currentFixedOvertime && currentFixedOvertime.enabled) {
    rows.push([currentFixedOvertime.allowanceName || '固定残業代', r.fixedOvertimePay, 'plain', true]);
  }
  rows.push(['割増手当', r.overtimePay, 'plain', true]);
  (r.overtimeBreakdown || []).forEach((it) => {
    rows.push([`　└ ${it.label}`, it.pay, 'sub', true]);
  });
  rows.push(
    ['その他手当（課税）', r.taxableAllowance, 'plain', true],
    ['通勤手当（非課税）', r.commuteAllowance, 'plain', true],
    ['総支給額', r.grossPay, 'total', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['源泉所得税（概算）', -r.monthlyIncomeTax, 'deduction', !r.isTaxExempt],
    ['住民税', -r.residentTax, 'deduction', true],
  );
  if (r.absenceDeduction) {
    rows.push(['欠勤控除', -r.absenceDeduction, 'deduction', true]);
  }

  const tbody = document.querySelector('#resultTable tbody');
  tbody.innerHTML = '';
  for (const [label, value, kind, applicable] of rows) {
    const tr = document.createElement('tr');
    if (kind === 'total') tr.className = 'total';
    if (kind === 'sub') tr.className = 'sub';
    const valueClass = !applicable ? 'value na' : (kind === 'deduction' ? 'value deduction' : 'value');
    const valueHtml = applicable ? yen(value) : '対象外';
    tr.innerHTML = `<td class="label">${label}</td><td class="${valueClass}">${valueHtml}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('netValue').textContent = yen(r.netPay);
}

async function renderHistoryTable() {
  const employee = await currentEmployee();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  if (!employee) { document.getElementById('historyEmptyState').style.display = ''; return; }

  const slips = await listPayslips(employee.id);
  const yms = Object.keys(slips).sort().reverse();
  document.getElementById('historyEmptyState').style.display = yms.length ? 'none' : '';
  document.getElementById('historyTable').style.display = yms.length ? '' : 'none';

  for (const ym of yms) {
    const slip = slips[ym];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ymLabel(ym)}</td>
      <td class="num">${formatThousands(slip.result.grossPay)} 円</td>
      <td class="num">${formatThousands(slip.result.netPay)} 円</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="view" data-ym="${ym}">表示</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-ym="${ym}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.getElementById('monthInput').value = btn.dataset.ym;
      await refreshAll();
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`${ymLabel(btn.dataset.ym)}分の給与明細を削除します。よろしいですか？`)) return;
      await deletePayslip(employee.id, btn.dataset.ym);
      await renderHistoryTable();
      await renderWageLedgerTable();
    });
  });
}

// 賃金台帳（様式第20号・労働基準法施行規則第55条）の記載事項を参考にした行定義。
// hours/日単位の行は小数第1位まで、円単位の行は千円区切りで表示する
const WAGE_LEDGER_ROWS = [
  { key: 'workDays', label: '労働日数', unit: '日' },
  { key: 'workedHours', label: '労働時間数', unit: '時間' },
  { key: 'holidayHours', label: '休日労働時間数', unit: '時間' },
  { key: 'overtimeHours', label: '早出残業時間数', unit: '時間' },
  { key: 'nightHours', label: '深夜労働時間数', unit: '時間' },
  { key: 'baseSalary', label: '基本賃金', unit: '円' },
  { key: 'overtimePayTotal', label: '所定時間外割増賃金', unit: '円' },
  { key: 'taxableAllowance', label: '手当', unit: '円' },
  { key: 'subtotal1', label: '小　計', unit: '円', bold: true },
  { key: 'commuteAllowance', label: '非課税分賃金額', unit: '円' },
  { key: 'specialPay', label: '臨時の給与', unit: '円' },
  { key: 'bonus', label: '賞与', unit: '円' },
  { key: 'total', label: '合　計', unit: '円', bold: true },
  { key: 'healthInsurance', label: '健康保険料', unit: '円' },
  { key: 'careInsurance', label: '介護保険料', unit: '円' },
  { key: 'childSupportLevy', label: '子ども・子育て支援金', unit: '円' },
  { key: 'pensionInsurance', label: '厚生年金保険料', unit: '円' },
  { key: 'employmentInsurance', label: '雇用保険料', unit: '円' },
  { key: 'socialInsuranceTotal', label: '社会保険料控除計', unit: '円', bold: true },
  { key: 'afterSocialInsurance', label: '差引残', unit: '円', bold: true },
  { key: 'monthlyIncomeTax', label: '源泉所得税', unit: '円' },
  { key: 'residentTax', label: '住民税', unit: '円' },
  { key: 'absenceDeduction', label: '欠勤控除', unit: '円' },
  { key: 'deductionTotal', label: '控除計', unit: '円', bold: true },
  { key: 'inKindPay', label: '実物給与', unit: '円' },
  { key: 'netPay', label: '差引支払金', unit: '円', bold: true },
];

// 保存済みの給与明細（ym単位）から、賃金台帳の1か月分の列を組み立てる。
// 労働日数・労働時間数等の勤怠由来の項目は、当時の勤怠入力から都度再集計する
async function buildWageLedgerColumns(employee, company) {
  const slips = await listPayslips(employee.id);
  const yms = Object.keys(slips).sort();
  const columns = [];
  for (const ym of yms) {
    const r = slips[ym].result;
    // eslint-disable-next-line no-await-in-loop
    const summary = await computeMonthSummary(employee, ym, company);
    const t = summary.overtimeCategoryMonthTotals;
    const holidayMin = (t.scheduledHoliday || 0) + (t.statutoryHoliday || 0) + (t.statutoryHolidayNight || 0);
    const overtimeMin = (t.overtimeWithin60 || 0) + (t.weeklyOvertime || 0) + (t.overtimeOver60 || 0)
      + (t.overtimeWithin60Night || 0) + (t.overtimeOver60Night || 0);
    const nightMin = (t.lateNight || 0) + (t.weeklyOvertimeNight || 0) + (t.overtimeWithin60Night || 0)
      + (t.overtimeOver60Night || 0) + (t.statutoryHolidayNight || 0);

    const subtotal1 = r.baseSalary + r.overtimePay + r.fixedOvertimePay + r.taxableAllowance;
    const total = subtotal1 + r.commuteAllowance;
    const afterSocialInsurance = total - r.socialInsuranceTotal;
    const absenceDeduction = r.absenceDeduction || 0;
    const deductionTotal = r.monthlyIncomeTax + r.residentTax + absenceDeduction;
    const netPay = afterSocialInsurance - deductionTotal;

    columns.push({
      ym,
      workDays: summary.workDays,
      workedHours: summary.workedHours,
      holidayHours: holidayMin / 60,
      overtimeHours: overtimeMin / 60,
      nightHours: nightMin / 60,
      baseSalary: r.baseSalary,
      overtimePayTotal: r.overtimePay + r.fixedOvertimePay,
      taxableAllowance: r.taxableAllowance,
      subtotal1,
      commuteAllowance: r.commuteAllowance,
      specialPay: 0,
      bonus: 0,
      total,
      healthInsurance: r.healthInsurance,
      careInsurance: r.careInsurance,
      childSupportLevy: r.childSupportLevy,
      pensionInsurance: r.pensionInsurance,
      employmentInsurance: r.employmentInsurance,
      socialInsuranceTotal: r.socialInsuranceTotal,
      afterSocialInsurance,
      monthlyIncomeTax: r.monthlyIncomeTax,
      residentTax: r.residentTax,
      absenceDeduction,
      deductionTotal,
      inKindPay: 0,
      netPay,
    });
  }
  return columns;
}

async function renderWageLedgerTable() {
  const employee = await currentEmployee();
  const theadRow = document.querySelector('#wageLedgerTable thead tr');
  const tbody = document.querySelector('#wageLedgerTable tbody');
  theadRow.innerHTML = '';
  tbody.innerHTML = '';
  if (!employee) {
    document.getElementById('wageLedgerEmptyState').style.display = '';
    document.querySelector('#wageLedgerCard .data-table-wrap').style.display = 'none';
    document.querySelector('#wageLedgerCard .export-row').style.display = 'none';
    return;
  }

  const company = await getCompany();
  const columns = await buildWageLedgerColumns(employee, company);
  const hasData = columns.length > 0;
  document.getElementById('wageLedgerEmptyState').style.display = hasData ? 'none' : '';
  document.querySelector('#wageLedgerCard .data-table-wrap').style.display = hasData ? '' : 'none';
  document.querySelector('#wageLedgerCard .export-row').style.display = hasData ? '' : 'none';
  if (!hasData) return;

  theadRow.innerHTML = `<th>項目</th>${columns.map((c) => `<th>${ymLabel(c.ym)}</th>`).join('')}`;
  tbody.innerHTML = WAGE_LEDGER_ROWS.map((rowDef) => {
    const cells = columns.map((c) => {
      const v = c[rowDef.key];
      const text = rowDef.unit === '時間' ? `${v.toFixed(1)} 時間` : (rowDef.unit === '日' ? `${v} 日` : `${formatThousands(Math.round(v))} 円`);
      return `<td class="num">${text}</td>`;
    }).join('');
    return `<tr${rowDef.bold ? ' class="total"' : ''}><td>${rowDef.label}</td>${cells}</tr>`;
  }).join('');
}

async function refreshAll() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  await loadFormForEmployeeMonth();
  await renderHistoryTable();
  await renderWageLedgerTable();
  document.getElementById('goAttendanceBtn').href = employee && ym
    ? `attendance.html?emp=${encodeURIComponent(employee.id)}&ym=${encodeURIComponent(ym)}`
    : 'attendance.html';
}

document.getElementById('employeeSelect').addEventListener('change', refreshAll);
document.getElementById('monthInput').addEventListener('change', refreshAll);
document.getElementById('calcBtn').addEventListener('click', calculate);

document.getElementById('saveBtn').addEventListener('click', async () => {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    const { input, result } = await calculate();
    await savePayslip(employee.id, ym, { input, result });
    showExportStatus('exportStatus', `${ymLabel(ym)}分の給与明細を保存しました。`, false);
    await renderHistoryTable();
    await renderWageLedgerTable();
  } catch (e) {
    showExportStatus('exportStatus', '保存に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('exportPdfBtn').addEventListener('click', () => printSection('resultCard'));
document.getElementById('exportExcelBtn').addEventListener('click', () => exportTableToExcel(
  'resultTable', '給与計算結果.xls',
  ['差引支給額（手取り）', document.getElementById('netValue').textContent.trim()],
  'exportStatus'
));
document.getElementById('exportCopyBtn').addEventListener('click', () => copyResultToClipboard(
  'resultTable',
  ['差引支給額（手取り）', document.getElementById('netValue').textContent.trim()],
  'exportStatus'
));

document.getElementById('exportLedgerPdfBtn').addEventListener('click', () => printSection('wageLedgerCard'));
document.getElementById('exportLedgerExcelBtn').addEventListener('click', () => exportFullTableToExcel('wageLedgerTable', '賃金台帳.xls', 'exportLedgerStatus'));
document.getElementById('exportLedgerCopyBtn').addEventListener('click', () => copyFullTableToClipboard('wageLedgerTable', 'exportLedgerStatus'));

['overtimePay', 'residentTax'].forEach(attachThousandsFormatting);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('payroll.html');
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
