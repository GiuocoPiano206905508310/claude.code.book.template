// ============================================================================
// 賞与計算画面のロジック
// ============================================================================

let editingBonusId = null;
// 従業員マスタ管理（保存済み賞与を表示中の場合はその当時の値）から取り込む、
// 賞与計算画面では編集不可の項目
let currentEmployeeFields = null;
// 会社マスタ管理（保存済み賞与を表示中の場合はその当時の値）から取り込む、
// 賞与計算画面では編集不可の項目
let currentCompanyFields = null;

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
  document.getElementById('bonusContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function renderEmployeeInfoGrid(fields) {
  renderInfoTiles('employeeInfoGrid', [
    ['雇用形態', fields.employmentType],
    ['年齢区分', AGE_GROUP_LABELS[fields.ageGroup] || fields.ageGroup],
    ['扶養親族等の数', `${fields.dependents} 人`],
    ['甲欄・乙欄', fields.taxTable === '甲' ? '甲欄' : '乙欄'],
  ]);
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

async function resetFormToNewBonus() {
  editingBonusId = null;
  const employee = await currentEmployee();
  if (!employee) return;
  const company = await getCompany();

  document.getElementById('bonusLabel').value = '';
  document.getElementById('bonusDate').value = new Date().toISOString().slice(0, 10);
  currentEmployeeFields = {
    employmentType: employee.employmentType,
    ageGroup: ageGroupFromAge(calcAge(employee.birthDate)),
    dependents: employee.dependents,
    taxTable: employee.taxTable,
  };
  renderEmployeeInfoGrid(currentEmployeeFields);

  currentCompanyFields = {
    calcMethod: company.calcMethod,
    healthRate: Number(company.healthRate) / 100,
    careRate: Number(company.careRate) / 100,
    pensionRate: Number(company.pensionRate) / 100,
    employmentRate: Number(company.employmentRate) / 100,
    healthInsuranceType: company.healthInsuranceType,
    prefecture: company.prefecture,
    industryType: company.industryType,
  };
  renderCompanyInfoGrid(currentCompanyFields);

  document.getElementById('bonusAmount').value = '500,000';
  document.getElementById('prevMonthSalary').value = '250,000';
  document.getElementById('bonusCalcPeriod').value = '6';
  document.getElementById('healthCumulative').value = '0';
  document.getElementById('pensionCumulative').value = '0';

  document.querySelector('#bonusResultTable tbody').innerHTML = '';
  document.getElementById('bonusNetValue').textContent = '— 円';
}

async function loadFormFromBonusRecord(record) {
  editingBonusId = record.id;
  document.getElementById('bonusLabel').value = record.label || '';
  document.getElementById('bonusDate').value = record.date || '';
  const input = record.input;
  currentEmployeeFields = {
    employmentType: input.employmentType,
    ageGroup: input.ageGroup,
    dependents: input.dependents,
    taxTable: input.taxTable,
  };
  renderEmployeeInfoGrid(currentEmployeeFields);

  const company = await getCompany();
  currentCompanyFields = {
    calcMethod: input.calcMethod,
    healthRate: input.healthRate,
    careRate: input.careRate,
    pensionRate: input.pensionRate,
    employmentRate: input.employmentRate,
    healthInsuranceType: company.healthInsuranceType,
    prefecture: company.prefecture,
    industryType: company.industryType,
  };
  renderCompanyInfoGrid(currentCompanyFields);

  document.getElementById('bonusAmount').value = formatThousands(input.bonusAmount);
  document.getElementById('prevMonthSalary').value = formatThousands(input.prevMonthSalary);
  document.getElementById('bonusCalcPeriod').value = String(input.calcPeriodMonths);
  document.getElementById('healthCumulative').value = formatThousands(input.healthCumulative);
  document.getElementById('pensionCumulative').value = formatThousands(input.pensionCumulative);

  renderResult(record.result);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectInput() {
  return {
    ...currentEmployeeFields,
    ...currentCompanyFields,
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

async function renderHistoryTable() {
  const employee = await currentEmployee();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  if (!employee) { document.getElementById('historyEmptyState').style.display = ''; return; }

  const records = (await listBonuses(employee.id)).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
    btn.addEventListener('click', async () => {
      const records2 = await listBonuses(employee.id);
      const record = records2.find((r) => r.id === btn.dataset.id);
      if (record) await loadFormFromBonusRecord(record);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('この賞与明細を削除します。よろしいですか？')) return;
      await deleteBonusRecord(employee.id, btn.dataset.id);
      if (editingBonusId === btn.dataset.id) await resetFormToNewBonus();
      await renderHistoryTable();
    });
  });
}

document.getElementById('employeeSelect').addEventListener('change', async () => {
  await resetFormToNewBonus();
  await renderHistoryTable();
});
document.getElementById('calcBonusBtn').addEventListener('click', calculate);

document.getElementById('saveBtn').addEventListener('click', async () => {
  const employee = await currentEmployee();
  if (!employee) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    const { input, result } = calculate();
    const record = await saveBonusRecord(employee.id, {
      id: editingBonusId,
      label: document.getElementById('bonusLabel').value.trim(),
      date: document.getElementById('bonusDate').value,
      input, result,
    });
    editingBonusId = record.id;
    showExportStatus('exportStatus', '賞与明細を保存しました。', false);
    await renderHistoryTable();
  } catch (e) {
    showExportStatus('exportStatus', '保存に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
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

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('bonus.html');
  renderNavbarUser(user);

  const hasEmployees = await populateEmployeeSelect();
  if (hasEmployees) {
    const params = new URLSearchParams(location.search);
    if (params.get('emp') && await getEmployee(params.get('emp'))) {
      document.getElementById('employeeSelect').value = params.get('emp');
    }
    await resetFormToNewBonus();
    await renderHistoryTable();
  }
})();
