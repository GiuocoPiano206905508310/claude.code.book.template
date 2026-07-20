// ============================================================================
// 給与計算画面のロジック
// ============================================================================

renderNavbar('payroll.html');

let currentAttendanceSummary = null;
let currentAutoOvertimePay = 0;

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
  document.getElementById('payrollContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function applyPrefectureRateToForm() {
  const prefecture = document.getElementById('prefecture').value;
  document.getElementById('healthRate').value = PREFECTURE_HEALTH_RATES[prefecture].toFixed(2);
  document.getElementById('careRate').value = CARE_RATE_DEFAULT.toFixed(2);
}

function applyHealthInsuranceTypeToForm() {
  const isKumiai = document.getElementById('healthInsuranceType').value === 'kumiai';
  document.getElementById('prefectureFieldRow').style.display = isKumiai ? 'none' : '';
  document.getElementById('careRate').readOnly = !isKumiai;
  document.getElementById('healthRateLabel').textContent = isKumiai ? '健康保険料率（手動入力）' : '健康保険料率（自動入力・編集可）';
  document.getElementById('careRateLabel').textContent = isKumiai ? '介護保険料率（手動入力）' : '介護保険料率（全国一律）';
  if (!isKumiai) applyPrefectureRateToForm();
}

function applyIndustryRateToForm() {
  const industry = document.getElementById('industryType').value;
  document.getElementById('employmentRate').value = EMPLOYMENT_RATES_BY_INDUSTRY[industry].toFixed(2);
}

function updateInsuranceFieldVisibilityInForm() {
  const employmentType = document.getElementById('employmentType').value;
  const hideHealthGroup = employmentType === 'アルバイト・パート' || employmentType === 'アルバイト・パート（雇用保険対象外）';
  const hideEmploymentGroup = employmentType === 'アルバイト・パート（雇用保険対象外）';

  ['rateSectionHeader', 'healthTypeFieldRow', 'rateGrid'].forEach((id) => {
    document.getElementById(id).style.display = hideHealthGroup ? 'none' : '';
  });
  ['industryFieldRow', 'employmentRateFieldRow'].forEach((id) => {
    document.getElementById(id).style.display = hideEmploymentGroup ? 'none' : '';
  });

  if (hideHealthGroup) {
    document.getElementById('prefectureFieldRow').style.display = 'none';
  } else {
    document.getElementById('prefectureFieldRow').style.display =
      document.getElementById('healthInsuranceType').value === 'kumiai' ? 'none' : '';
  }
}

function applyEmploymentTypeLabelToForm() {
  const employmentType = document.getElementById('employmentType').value;
  document.getElementById('baseSalaryLabel').textContent = employmentType === '役員' ? '役員報酬' : '基本給';
}

// 従業員マスタ・勤怠集計をもとに、フォームへ初期値を流し込む
function loadFormForEmployeeMonth() {
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;

  currentAttendanceSummary = computeMonthSummary(employee, ym);
  const overtimeBaseWage = employee.baseSalary + sumNonExcludedAllowances(employee.allowances);
  currentAutoOvertimePay = calcOvertimePayFromHours(
    overtimeBaseWage, employee.monthlyStandardHours, currentAttendanceSummary.overtimeHours, employee.overtimeWithin60Rate
  );
  const absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
  const employeeAgeGroup = ageGroupFromAge(calcAge(employee.birthDate));

  const saved = getPayslip(employee.id, ym);
  const input = saved ? saved.input : null;

  document.getElementById('employmentType').value = input ? input.employmentType : employee.employmentType;
  document.getElementById('ageGroup').value = input ? input.ageGroup : employeeAgeGroup;
  document.getElementById('baseSalary').value = formatThousands(input ? input.baseSalary : employee.baseSalary);
  document.getElementById('overtimePay').value = formatThousands(input ? input.overtimePay : currentAutoOvertimePay);
  document.getElementById('taxableAllowance').value = formatThousands(input ? input.taxableAllowance : sumAllowances(employee.allowances));
  document.getElementById('commuteAllowance').value = formatThousands(input ? input.commuteAllowance : employee.commuteAllowance);
  document.getElementById('dependents').value = input ? input.dependents : employee.dependents;
  document.getElementById('calcMethod').value = input ? input.calcMethod : employee.calcMethod;
  document.getElementById('taxTable').value = input ? input.taxTable : employee.taxTable;
  document.getElementById('residentTax').value = formatThousands(input ? input.residentTax : employee.residentTax);
  document.getElementById('healthInsuranceType').value = employee.healthInsuranceType;
  populatePrefectureSelect('prefecture', employee.prefecture);
  populateIndustrySelect('industryType', employee.industryType);
  document.getElementById('applyAbsenceDeduction').checked = input ? !!input.applyAbsenceDeduction : currentAttendanceSummary.absenceDays > 0;

  applyEmploymentTypeLabelToForm();
  updateInsuranceFieldVisibilityInForm();
  applyIndustryRateToForm();
  document.getElementById('healthRate').value = Number(input ? input.healthRate : employee.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(input ? input.careRate : employee.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(input ? input.pensionRate : employee.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(input ? input.employmentRate : employee.employmentRate).toFixed(2);

  document.getElementById('overtimeNote').textContent =
    `勤怠集計：残業 ${currentAttendanceSummary.overtimeHours.toFixed(1)}h ×「法定外労働時間(月60時間以内)」の割増率(${Number(employee.overtimeWithin60Rate).toFixed(2)}倍) → 自動計算額 ${formatThousands(currentAutoOvertimePay)} 円（編集可。深夜・休日等の割増区分は従業員マスタで設定・手動反映してください）`;
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
}

function collectInput() {
  return {
    employmentType: document.getElementById('employmentType').value,
    ageGroup: document.getElementById('ageGroup').value,
    taxTable: document.getElementById('taxTable').value,
    calcMethod: document.getElementById('calcMethod').value,
    baseSalary: getNumInputValue('baseSalary'),
    overtimePay: getNumInputValue('overtimePay'),
    taxableAllowance: getNumInputValue('taxableAllowance'),
    commuteAllowance: getNumInputValue('commuteAllowance'),
    dependents: Number(document.getElementById('dependents').value) || 0,
    residentTax: getNumInputValue('residentTax'),
    healthRate: Number(document.getElementById('healthRate').value) / 100,
    careRate: Number(document.getElementById('careRate').value) / 100,
    pensionRate: Number(document.getElementById('pensionRate').value) / 100,
    employmentRate: Number(document.getElementById('employmentRate').value) / 100,
    applyAbsenceDeduction: document.getElementById('applyAbsenceDeduction').checked,
  };
}

function calculate() {
  const input = collectInput();
  const result = calculateMonthlyPayroll(input);

  const employee = currentEmployee();
  result.absenceDeduction = 0;
  if (input.applyAbsenceDeduction && employee && currentAttendanceSummary) {
    result.absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
    result.netPay -= result.absenceDeduction;
  }

  renderResult(result);
  return { input, result };
}

function renderResult(r) {
  const rows = [
    ['総支給額', r.grossPay, 'plain', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['源泉所得税（概算）', -r.monthlyIncomeTax, 'deduction', !r.isTaxExempt],
    ['住民税', -r.residentTax, 'deduction', true],
  ];
  if (r.absenceDeduction) {
    rows.push(['欠勤控除', -r.absenceDeduction, 'deduction', true]);
  }

  const tbody = document.querySelector('#resultTable tbody');
  tbody.innerHTML = '';
  for (const [label, value, kind, applicable] of rows) {
    const tr = document.createElement('tr');
    if (kind === 'total') tr.className = 'total';
    const valueClass = !applicable ? 'value na' : (kind === 'deduction' ? 'value deduction' : 'value');
    const valueHtml = applicable ? yen(value) : '対象外';
    tr.innerHTML = `<td class="label">${label}</td><td class="${valueClass}">${valueHtml}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('netValue').textContent = yen(r.netPay);
}

function renderHistoryTable() {
  const employee = currentEmployee();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  if (!employee) { document.getElementById('historyEmptyState').style.display = ''; return; }

  const slips = listPayslips(employee.id);
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
    btn.addEventListener('click', () => {
      document.getElementById('monthInput').value = btn.dataset.ym;
      refreshAll();
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm(`${ymLabel(btn.dataset.ym)}分の給与明細を削除します。よろしいですか？`)) return;
      deletePayslip(employee.id, btn.dataset.ym);
      renderHistoryTable();
    });
  });
}

function refreshAll() {
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  loadFormForEmployeeMonth();
  renderHistoryTable();
  document.getElementById('goAttendanceBtn').href = employee && ym
    ? `attendance.html?emp=${encodeURIComponent(employee.id)}&ym=${encodeURIComponent(ym)}`
    : 'attendance.html';
}

document.getElementById('employeeSelect').addEventListener('change', refreshAll);
document.getElementById('monthInput').addEventListener('change', refreshAll);
document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);
document.getElementById('employmentType').addEventListener('change', () => {
  applyEmploymentTypeLabelToForm();
  updateInsuranceFieldVisibilityInForm();
});
document.getElementById('calcBtn').addEventListener('click', calculate);

document.getElementById('saveBtn').addEventListener('click', () => {
  const employee = currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;
  const { input, result } = calculate();
  savePayslip(employee.id, ym, { input, result });
  showExportStatus('exportStatus', `${ymLabel(ym)}分の給与明細を保存しました。`, false);
  renderHistoryTable();
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

['baseSalary', 'overtimePay', 'taxableAllowance', 'commuteAllowance', 'residentTax'].forEach(attachThousandsFormatting);

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
