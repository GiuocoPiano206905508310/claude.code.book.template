// ============================================================================
// 従業員マスタ管理画面のロジック
// ============================================================================

renderNavbar('employees.html');

let editingId = null;

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

function applyEmploymentTypeLabelToForm() {
  const employmentType = document.getElementById('employmentType').value;
  document.getElementById('baseSalaryLabel').textContent = employmentType === '役員' ? '役員報酬（円）' : '基本給（円）';
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
    applyHealthInsuranceTypeToForm();
  }
}

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = '従業員を新規登録';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('empName').value = '';
  document.getElementById('employmentType').value = '正社員';
  document.getElementById('ageGroup').value = 'under40';
  document.getElementById('baseSalary').value = '280,000';
  document.getElementById('taxableAllowance').value = '10,000';
  document.getElementById('commuteAllowance').value = '10,000';
  document.getElementById('dependents').value = '0';
  document.getElementById('calcMethod').value = 'table';
  document.getElementById('taxTable').value = '甲';
  document.getElementById('residentTax').value = '0';
  document.getElementById('healthInsuranceType').value = 'kyoukai';
  populatePrefectureSelect('prefecture', '東京');
  populateIndustrySelect('industryType', '一般の事業');
  document.getElementById('workStart').value = '09:00';
  document.getElementById('workEnd').value = '18:00';
  document.getElementById('standardDailyHours').value = '8';
  document.getElementById('overtimeRate').value = '1.25';
  document.getElementById('monthlyStandardHours').value = '160';
  document.getElementById('monthlyStandardDays').value = '20';
  applyEmploymentTypeLabelToForm();
  applyHealthInsuranceTypeToForm();
  applyIndustryRateToForm();
  updateInsuranceFieldVisibilityInForm();
}

function loadFormFromEmployee(emp) {
  editingId = emp.id;
  document.getElementById('formTitle').textContent = `従業員を編集：${emp.name}`;
  document.getElementById('cancelEditBtn').style.display = '';
  document.getElementById('empName').value = emp.name;
  document.getElementById('employmentType').value = emp.employmentType;
  document.getElementById('ageGroup').value = emp.ageGroup;
  document.getElementById('baseSalary').value = formatThousands(emp.baseSalary);
  document.getElementById('taxableAllowance').value = formatThousands(emp.taxableAllowance);
  document.getElementById('commuteAllowance').value = formatThousands(emp.commuteAllowance);
  document.getElementById('dependents').value = emp.dependents;
  document.getElementById('calcMethod').value = emp.calcMethod;
  document.getElementById('taxTable').value = emp.taxTable;
  document.getElementById('residentTax').value = formatThousands(emp.residentTax);
  document.getElementById('healthInsuranceType').value = emp.healthInsuranceType;
  populatePrefectureSelect('prefecture', emp.prefecture);
  populateIndustrySelect('industryType', emp.industryType);
  document.getElementById('workStart').value = emp.workStart || '09:00';
  document.getElementById('workEnd').value = emp.workEnd || '18:00';
  document.getElementById('standardDailyHours').value = emp.standardDailyHours || 8;
  document.getElementById('overtimeRate').value = emp.overtimeRate || 1.25;
  document.getElementById('monthlyStandardHours').value = emp.monthlyStandardHours || 160;
  document.getElementById('monthlyStandardDays').value = emp.monthlyStandardDays || 20;
  applyEmploymentTypeLabelToForm();
  updateInsuranceFieldVisibilityInForm();
  applyIndustryRateToForm();
  document.getElementById('healthRate').value = Number(emp.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(emp.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(emp.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(emp.employmentRate).toFixed(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectFormAsEmployee() {
  const name = document.getElementById('empName').value.trim();
  return {
    id: editingId,
    name: name || '(氏名未入力)',
    employmentType: document.getElementById('employmentType').value,
    ageGroup: document.getElementById('ageGroup').value,
    baseSalary: getNumInputValue('baseSalary'),
    taxableAllowance: getNumInputValue('taxableAllowance'),
    commuteAllowance: getNumInputValue('commuteAllowance'),
    dependents: Number(document.getElementById('dependents').value) || 0,
    calcMethod: document.getElementById('calcMethod').value,
    taxTable: document.getElementById('taxTable').value,
    residentTax: getNumInputValue('residentTax'),
    healthInsuranceType: document.getElementById('healthInsuranceType').value,
    prefecture: document.getElementById('prefecture').value,
    healthRate: Number(document.getElementById('healthRate').value) || 0,
    careRate: Number(document.getElementById('careRate').value) || 0,
    pensionRate: Number(document.getElementById('pensionRate').value) || 0,
    industryType: document.getElementById('industryType').value,
    employmentRate: Number(document.getElementById('employmentRate').value) || 0,
    workStart: document.getElementById('workStart').value || '09:00',
    workEnd: document.getElementById('workEnd').value || '18:00',
    standardDailyHours: Number(document.getElementById('standardDailyHours').value) || 8,
    overtimeRate: Number(document.getElementById('overtimeRate').value) || 1.25,
    monthlyStandardHours: Number(document.getElementById('monthlyStandardHours').value) || 160,
    monthlyStandardDays: Number(document.getElementById('monthlyStandardDays').value) || 20,
  };
}

function renderEmployeeTable() {
  const employees = listEmployees();
  const tbody = document.querySelector('#employeeTable tbody');
  tbody.innerHTML = '';
  document.getElementById('emptyState').style.display = employees.length ? 'none' : '';
  document.getElementById('employeeTable').style.display = employees.length ? '' : 'none';

  for (const emp of employees) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(emp.name)}</td>
      <td>${escapeHtml(emp.employmentType)}</td>
      <td class="num">${formatThousands(emp.baseSalary)} 円</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="edit" data-id="${emp.id}">編集</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${emp.id}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emp = getEmployee(btn.dataset.id);
      if (emp) loadFormFromEmployee(emp);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emp = getEmployee(btn.dataset.id);
      if (!emp) return;
      const ok = confirm(`「${emp.name}」を削除します。この従業員に紐づく勤怠・給与・賞与の記録もすべて削除されます。よろしいですか？`);
      if (!ok) return;
      deleteEmployee(emp.id);
      if (editingId === emp.id) resetForm();
      renderEmployeeTable();
    });
  });
}

document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);
document.getElementById('employmentType').addEventListener('change', () => {
  applyEmploymentTypeLabelToForm();
  updateInsuranceFieldVisibilityInForm();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const emp = collectFormAsEmployee();
  if (!document.getElementById('empName').value.trim()) {
    alert('氏名を入力してください。');
    return;
  }
  saveEmployee(emp);
  resetForm();
  renderEmployeeTable();
});
document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

['baseSalary', 'taxableAllowance', 'commuteAllowance', 'residentTax'].forEach(attachThousandsFormatting);

resetForm();
renderEmployeeTable();
