// ============================================================================
// 賞与計算画面のロジック
// ============================================================================

renderNavbar('bonus.html');

let editingBonusId = null;

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
  document.getElementById('bonusContent').style.display = hasEmployees ? '' : 'none';
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

  ['rateSectionHeader', 'healthTypeFieldRow', 'rateGrid', 'healthCumulativeRow', 'pensionCumulativeRow'].forEach((id) => {
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

function resetFormToNewBonus() {
  editingBonusId = null;
  const employee = currentEmployee();
  if (!employee) return;

  document.getElementById('bonusLabel').value = '';
  document.getElementById('bonusDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('employmentType').value = employee.employmentType;
  document.getElementById('ageGroup').value = ageGroupFromAge(calcAge(employee.birthDate));
  document.getElementById('dependents').value = employee.dependents;
  document.getElementById('calcMethod').value = employee.calcMethod;
  document.getElementById('taxTable').value = employee.taxTable;
  document.getElementById('bonusAmount').value = '500,000';
  document.getElementById('prevMonthSalary').value = '250,000';
  document.getElementById('bonusCalcPeriod').value = '6';
  document.getElementById('healthInsuranceType').value = employee.healthInsuranceType;
  populatePrefectureSelect('prefecture', employee.prefecture);
  populateIndustrySelect('industryType', employee.industryType);
  document.getElementById('healthCumulative').value = '0';
  document.getElementById('pensionCumulative').value = '0';

  updateInsuranceFieldVisibilityInForm();
  applyIndustryRateToForm();
  document.getElementById('healthRate').value = Number(employee.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(employee.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(employee.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(employee.employmentRate).toFixed(2);

  document.querySelector('#bonusResultTable tbody').innerHTML = '';
  document.getElementById('bonusNetValue').textContent = '— 円';
}

function loadFormFromBonusRecord(record) {
  editingBonusId = record.id;
  document.getElementById('bonusLabel').value = record.label || '';
  document.getElementById('bonusDate').value = record.date || '';
  const input = record.input;
  document.getElementById('employmentType').value = input.employmentType;
  document.getElementById('ageGroup').value = input.ageGroup;
  document.getElementById('dependents').value = input.dependents;
  document.getElementById('calcMethod').value = input.calcMethod;
  document.getElementById('taxTable').value = input.taxTable;
  document.getElementById('bonusAmount').value = formatThousands(input.bonusAmount);
  document.getElementById('prevMonthSalary').value = formatThousands(input.prevMonthSalary);
  document.getElementById('bonusCalcPeriod').value = String(input.calcPeriodMonths);
  const employee = currentEmployee();
  populatePrefectureSelect('prefecture', employee ? employee.prefecture : null);
  document.getElementById('healthCumulative').value = formatThousands(input.healthCumulative);
  document.getElementById('pensionCumulative').value = formatThousands(input.pensionCumulative);

  updateInsuranceFieldVisibilityInForm();
  document.getElementById('healthRate').value = (input.healthRate * 100).toFixed(2);
  document.getElementById('careRate').value = (input.careRate * 100).toFixed(2);
  document.getElementById('pensionRate').value = (input.pensionRate * 100).toFixed(2);
  document.getElementById('employmentRate').value = (input.employmentRate * 100).toFixed(2);

  renderResult(record.result);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectInput() {
  return {
    employmentType: document.getElementById('employmentType').value,
    ageGroup: document.getElementById('ageGroup').value,
    taxTable: document.getElementById('taxTable').value,
    calcMethod: document.getElementById('calcMethod').value,
    dependents: Number(document.getElementById('dependents').value) || 0,
    healthRate: Number(document.getElementById('healthRate').value) / 100,
    careRate: Number(document.getElementById('careRate').value) / 100,
    pensionRate: Number(document.getElementById('pensionRate').value) / 100,
    employmentRate: Number(document.getElementById('employmentRate').value) / 100,
    bonusAmount: getNumInputValue('bonusAmount'),
    prevMonthSalary: getNumInputValue('prevMonthSalary'),
    calcPeriodMonths: Number(document.getElementById('bonusCalcPeriod').value) || 6,
    healthCumulative: getNumInputValue('healthCumulative'),
    pensionCumulative: getNumInputValue('pensionCumulative'),
  };
}

function calculate() {
  const input = collectInput();
  const result = calculateBonusPayroll(input);
  renderResult(result);
  return { input, result };
}

function renderResult(r) {
  const rows = [
    ['支払い状況（自動判定）', BONUS_SITUATION_LABELS[r.situation], 'text', true],
    ['賞与額', r.bonusAmount, 'plain', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['源泉所得税（概算）', -r.incomeTax, 'deduction', true],
  ];

  const tbody = document.querySelector('#bonusResultTable tbody');
  tbody.innerHTML = '';
  for (const [label, value, kind, applicable] of rows) {
    const tr = document.createElement('tr');
    if (kind === 'total') tr.className = 'total';
    const valueClass = !applicable ? 'value na' : (kind === 'deduction' ? 'value deduction' : 'value');
    const valueHtml = !applicable ? '対象外' : (kind === 'text' ? value : yen(value));
    tr.innerHTML = `<td class="label">${label}</td><td class="${valueClass}">${valueHtml}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('bonusNetValue').textContent = yen(r.netPay);
}

function renderHistoryTable() {
  const employee = currentEmployee();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  if (!employee) { document.getElementById('historyEmptyState').style.display = ''; return; }

  const records = listBonuses(employee.id).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  document.getElementById('historyEmptyState').style.display = records.length ? 'none' : '';
  document.getElementById('historyTable').style.display = records.length ? '' : 'none';

  for (const record of records) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(record.date || '—')}</td>
      <td>${escapeHtml(record.label || '(ラベル未設定)')}</td>
      <td class="num">${formatThousands(record.result.bonusAmount)} 円</td>
      <td class="num">${formatThousands(record.result.netPay)} 円</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="view" data-id="${record.id}">表示</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${record.id}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const record = listBonuses(employee.id).find((r) => r.id === btn.dataset.id);
      if (record) loadFormFromBonusRecord(record);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('この賞与明細を削除します。よろしいですか？')) return;
      deleteBonusRecord(employee.id, btn.dataset.id);
      if (editingBonusId === btn.dataset.id) resetFormToNewBonus();
      renderHistoryTable();
    });
  });
}

document.getElementById('employeeSelect').addEventListener('change', () => {
  resetFormToNewBonus();
  renderHistoryTable();
});
document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);
document.getElementById('employmentType').addEventListener('change', updateInsuranceFieldVisibilityInForm);
document.getElementById('calcBonusBtn').addEventListener('click', calculate);

document.getElementById('saveBtn').addEventListener('click', () => {
  const employee = currentEmployee();
  if (!employee) return;
  const { input, result } = calculate();
  const record = saveBonusRecord(employee.id, {
    id: editingBonusId,
    label: document.getElementById('bonusLabel').value.trim(),
    date: document.getElementById('bonusDate').value,
    input, result,
  });
  editingBonusId = record.id;
  showExportStatus('exportStatus', '賞与明細を保存しました。', false);
  renderHistoryTable();
});

document.getElementById('exportPdfBtn').addEventListener('click', () => printSection('resultCard'));
document.getElementById('exportExcelBtn').addEventListener('click', () => exportTableToExcel(
  'bonusResultTable', '賞与計算結果.xls',
  ['差引支給額（手取り）', document.getElementById('bonusNetValue').textContent.trim()],
  'exportStatus'
));
document.getElementById('exportCopyBtn').addEventListener('click', () => copyResultToClipboard(
  'bonusResultTable',
  ['差引支給額（手取り）', document.getElementById('bonusNetValue').textContent.trim()],
  'exportStatus'
));

['bonusAmount', 'prevMonthSalary', 'healthCumulative', 'pensionCumulative'].forEach(attachThousandsFormatting);

const hasEmployees = populateEmployeeSelect();
if (hasEmployees) {
  const params = new URLSearchParams(location.search);
  if (params.get('emp') && getEmployee(params.get('emp'))) {
    document.getElementById('employeeSelect').value = params.get('emp');
  }
  resetFormToNewBonus();
  renderHistoryTable();
}
