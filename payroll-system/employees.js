// ============================================================================
// 従業員マスタ管理画面のロジック
// ============================================================================

renderNavbar('employees.html');

let editingId = null;
let allowanceSeq = 0;
let ageUpdateTimer = null;

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

// ---------------------------------------------------------------------------
// 生年月日 → 現在の年齢（日本時間でリアルタイムに更新）
// ---------------------------------------------------------------------------
function updateAgeDisplay() {
  const birthDate = document.getElementById('birthDate').value;
  const el = document.getElementById('ageDisplay');
  if (!birthDate) { el.innerHTML = ''; return; }
  const now = getJstNow();
  const age = calcAge(birthDate, now);
  const jstLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 日本時間`;
  el.innerHTML = `現在の年齢：<strong>${age}歳</strong>（${jstLabel} 現在）`;
}

function startAgeAutoUpdate() {
  if (ageUpdateTimer) clearInterval(ageUpdateTimer);
  ageUpdateTimer = setInterval(updateAgeDisplay, 30000);
}

// ---------------------------------------------------------------------------
// フリガナの自動入力
// IME変換で漢字に確定した後は「読み」を取得する標準APIが無いため、
// 変換前（＝入力中の文字がまだ全てかなの間）の値を随時保持しておき、
// 漢字に変換された時点でその直前のかな表記を読みとして採用する。
// ---------------------------------------------------------------------------
const KANA_ONLY_PATTERN = /^[ぁ-ゖァ-ヺー\s]*$/;

function setupFuriganaAutoFill() {
  const nameInput = document.getElementById('empName');
  const kanaInput = document.getElementById('empNameKana');
  let composing = false;
  let reading = '';

  nameInput.addEventListener('compositionstart', () => {
    composing = true;
    reading = '';
  });

  nameInput.addEventListener('input', (e) => {
    if (!(composing || e.isComposing)) return;
    const value = nameInput.value;
    if (KANA_ONLY_PATTERN.test(value) && value.trim()) {
      reading = value;
    }
  });

  nameInput.addEventListener('compositionend', (e) => {
    composing = false;
    const finalData = e.data || '';
    const source = KANA_ONLY_PATTERN.test(finalData) && finalData ? finalData : reading;
    if (source) {
      kanaInput.value = hiraganaToKatakana(source);
    }
    reading = '';
  });
}

// ---------------------------------------------------------------------------
// 割増率（9区分）
// ---------------------------------------------------------------------------
function renderOvertimeRatesList(rates) {
  const container = document.getElementById('overtimeRatesList');
  container.innerHTML = OVERTIME_RATE_CATEGORIES.map((c) => `
    <div class="field-row" data-rate-key="${c.key}">
      <label for="rate_${c.key}">${c.label}</label>
      <div class="field-input" id="rateInput_${c.key}">
        <input type="number" id="rate_${c.key}" min="0" step="0.01" value="${Number(rates[c.key]).toFixed(2)}">
        <span class="unit">倍</span>
      </div>
      <p class="rate-error" id="rateError_${c.key}"></p>
    </div>
  `).join('');

  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    document.getElementById(`rate_${c.key}`).addEventListener('input', () => validateRateField(c.key));
  });
}

function validateRateField(key) {
  const category = OVERTIME_RATE_CATEGORIES.find((c) => c.key === key);
  const input = document.getElementById(`rate_${key}`);
  const errorEl = document.getElementById(`rateError_${key}`);
  const wrap = document.getElementById(`rateInput_${key}`);
  const value = Number(input.value);
  const invalid = Number.isNaN(value) || value < category.defaultRate;
  errorEl.textContent = invalid ? '法定の割増率を下回っています' : '';
  wrap.classList.toggle('is-invalid', invalid);
  return !invalid;
}

function validateAllRateFields() {
  let allValid = true;
  let firstInvalidKey = null;
  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    const ok = validateRateField(c.key);
    if (!ok && !firstInvalidKey) firstInvalidKey = c.key;
    allValid = allValid && ok;
  });
  if (firstInvalidKey) {
    document.getElementById(`rate_${firstInvalidKey}`).focus();
  }
  return allValid;
}

function collectRatesFromForm() {
  const rates = {};
  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    rates[c.key] = Number(document.getElementById(`rate_${c.key}`).value) || c.defaultRate;
  });
  return rates;
}

// ---------------------------------------------------------------------------
// その他手当（複数行、割増賃金基礎からの除外チェック付き）
// ---------------------------------------------------------------------------
function allowanceRowHtml(a) {
  const seq = allowanceSeq++;
  return `
    <div class="allowance-row" data-seq="${seq}">
      <div>
        <label class="mini-label" for="allowanceName_${seq}">手当名</label>
        <input type="text" id="allowanceName_${seq}" class="allowance-name" value="${escapeHtml(a.name || '')}" placeholder="例：役職手当">
      </div>
      <div>
        <label class="mini-label" for="allowanceAmount_${seq}">金額</label>
        <div class="field-input">
          <input type="text" inputmode="numeric" id="allowanceAmount_${seq}" class="allowance-amount" value="${formatThousands(a.amount || 0)}">
          <span class="unit">円</span>
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="allowanceExclude_${seq}" class="allowance-exclude" ${a.excludeFromOvertimeBase ? 'checked' : ''}>
        <label for="allowanceExclude_${seq}">割増賃金の基礎となる賃金から除外</label>
      </div>
      <button type="button" class="btn btn-sm btn-danger allowance-remove">削除</button>
    </div>
  `;
}

function renderAllowanceRows(allowances) {
  const container = document.getElementById('allowancesList');
  const list = allowances && allowances.length ? allowances : [{ name: 'その他手当', amount: 10000, excludeFromOvertimeBase: false }];
  container.innerHTML = list.map(allowanceRowHtml).join('');
  attachAllowanceRowEvents();
}

function attachAllowanceRowEvents() {
  const container = document.getElementById('allowancesList');
  container.querySelectorAll('.allowance-amount').forEach((input) => {
    if (!input.dataset.formatBound) {
      input.dataset.formatBound = '1';
      attachThousandsFormatting(input.id);
    }
  });
  container.querySelectorAll('.allowance-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.allowance-row');
      if (container.querySelectorAll('.allowance-row').length <= 1) {
        row.querySelector('.allowance-name').value = '';
        row.querySelector('.allowance-amount').value = '0';
        row.querySelector('.allowance-exclude').checked = false;
        return;
      }
      row.remove();
    });
  });
}

function addAllowanceRow() {
  const container = document.getElementById('allowancesList');
  container.insertAdjacentHTML('beforeend', allowanceRowHtml({ name: '', amount: 0, excludeFromOvertimeBase: false }));
  attachAllowanceRowEvents();
}

function collectAllowancesFromForm() {
  return Array.from(document.querySelectorAll('#allowancesList .allowance-row')).map((row) => ({
    name: row.querySelector('.allowance-name').value.trim(),
    amount: Number(row.querySelector('.allowance-amount').value.replace(/,/g, '')) || 0,
    excludeFromOvertimeBase: row.querySelector('.allowance-exclude').checked,
  })).filter((a) => a.name || a.amount);
}

// ---------------------------------------------------------------------------
// フォームの初期化・読み込み・保存
// ---------------------------------------------------------------------------
function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = '従業員を新規登録';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('empName').value = '';
  document.getElementById('empNameKana').value = '';
  document.getElementById('employmentType').value = '正社員';
  document.getElementById('birthDate').value = '1990-01-01';
  document.getElementById('baseSalary').value = '280,000';
  renderAllowanceRows([{ name: 'その他手当', amount: 10000, excludeFromOvertimeBase: false }]);
  document.getElementById('commuteAllowance').value = '10,000';
  document.getElementById('commuteAllowanceExclude').checked = true;
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
  document.getElementById('monthlyStandardHours').value = '160';
  document.getElementById('monthlyStandardDays').value = '20';
  renderOvertimeRatesList(defaultOvertimeRates());
  applyEmploymentTypeLabelToForm();
  applyHealthInsuranceTypeToForm();
  applyIndustryRateToForm();
  updateInsuranceFieldVisibilityInForm();
  updateAgeDisplay();
}

function loadFormFromEmployee(emp) {
  editingId = emp.id;
  document.getElementById('formTitle').textContent = `従業員を編集：${emp.name}`;
  document.getElementById('cancelEditBtn').style.display = '';
  document.getElementById('empName').value = emp.name;
  document.getElementById('empNameKana').value = emp.nameKana || '';
  document.getElementById('employmentType').value = emp.employmentType;
  document.getElementById('birthDate').value = emp.birthDate || '1990-01-01';
  document.getElementById('baseSalary').value = formatThousands(emp.baseSalary);
  const allowances = emp.allowances && emp.allowances.length
    ? emp.allowances
    : (emp.taxableAllowance ? [{ name: 'その他手当', amount: emp.taxableAllowance, excludeFromOvertimeBase: false }] : []);
  renderAllowanceRows(allowances);
  document.getElementById('commuteAllowance').value = formatThousands(emp.commuteAllowance);
  document.getElementById('commuteAllowanceExclude').checked = emp.commuteAllowanceExcludeFromOvertimeBase !== false;
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
  document.getElementById('monthlyStandardHours').value = emp.monthlyStandardHours || 160;
  document.getElementById('monthlyStandardDays').value = emp.monthlyStandardDays || 20;
  const storedRates = Object.assign({}, defaultOvertimeRates());
  OVERTIME_RATE_CATEGORIES.forEach((c) => {
    if (emp[c.key] !== undefined) storedRates[c.key] = emp[c.key];
  });
  renderOvertimeRatesList(storedRates);
  applyEmploymentTypeLabelToForm();
  updateInsuranceFieldVisibilityInForm();
  applyIndustryRateToForm();
  document.getElementById('healthRate').value = Number(emp.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(emp.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(emp.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(emp.employmentRate).toFixed(2);
  updateAgeDisplay();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectFormAsEmployee() {
  const name = document.getElementById('empName').value.trim();
  const rates = collectRatesFromForm();
  return Object.assign({
    id: editingId,
    name: name || '(氏名未入力)',
    nameKana: document.getElementById('empNameKana').value.trim(),
    employmentType: document.getElementById('employmentType').value,
    birthDate: document.getElementById('birthDate').value || null,
    baseSalary: getNumInputValue('baseSalary'),
    allowances: collectAllowancesFromForm(),
    commuteAllowance: getNumInputValue('commuteAllowance'),
    commuteAllowanceExcludeFromOvertimeBase: document.getElementById('commuteAllowanceExclude').checked,
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
    monthlyStandardHours: Number(document.getElementById('monthlyStandardHours').value) || 160,
    monthlyStandardDays: Number(document.getElementById('monthlyStandardDays').value) || 20,
  }, rates);
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
      <td>${escapeHtml(emp.name)}${emp.nameKana ? `<br><span style="font-size:11px;color:var(--ink-faint);">${escapeHtml(emp.nameKana)}</span>` : ''}</td>
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
document.getElementById('birthDate').addEventListener('change', updateAgeDisplay);
document.getElementById('addAllowanceBtn').addEventListener('click', addAllowanceRow);

document.getElementById('saveBtn').addEventListener('click', () => {
  if (!document.getElementById('empName').value.trim()) {
    alert('氏名を入力してください。');
    return;
  }
  if (!validateAllRateFields()) {
    alert('割増率が法定の下限を下回っている項目があります。赤字のエラーを確認し、修正してください。');
    return;
  }
  const emp = collectFormAsEmployee();
  saveEmployee(emp);
  resetForm();
  renderEmployeeTable();
});
document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

['baseSalary', 'commuteAllowance', 'residentTax'].forEach(attachThousandsFormatting);
setupFuriganaAutoFill();
startAgeAutoUpdate();

resetForm();
renderEmployeeTable();
