// ============================================================================
// 従業員マスタ管理画面のロジック
// ============================================================================

let editingId = null;
let allowanceSeq = 0;
let ageUpdateTimer = null;

function applyEmploymentTypeLabelToForm() {
  const employmentType = document.getElementById('employmentType').value;
  document.getElementById('baseSalaryLabel').textContent = employmentType === '役員' ? '役員報酬（円）' : '基本給（円）';
}

// ---------------------------------------------------------------------------
// 社会保険設定（標準報酬月額）
// プルダウン（等級表の金額）から選択、または「その他」で直接入力の両方に対応する
// ---------------------------------------------------------------------------
function populateStandardMonthlySelect(selectId, brackets) {
  const select = document.getElementById(selectId);
  select.innerHTML = brackets.map((b) => `<option value="${b.amount}">${formatThousands(b.amount)}円</option>`).join('')
    + '<option value="custom">その他（直接入力）</option>';
}

function toggleStandardMonthlyCustomWrap(selectId, wrapId) {
  const isCustom = document.getElementById(selectId).value === 'custom';
  document.getElementById(wrapId).style.display = isCustom ? '' : 'none';
}

function setStandardMonthlyValue(selectId, customId, wrapId, amount, brackets) {
  const select = document.getElementById(selectId);
  const matches = brackets.some((b) => b.amount === amount);
  select.value = matches ? String(amount) : 'custom';
  document.getElementById(customId).value = formatThousands(amount);
  toggleStandardMonthlyCustomWrap(selectId, wrapId);
}

function getStandardMonthlyValue(selectId, customId) {
  const select = document.getElementById(selectId);
  return select.value === 'custom' ? getNumInputValue(customId) : Number(select.value) || 0;
}

// 基本給・固定残業代（有効時）・各種手当・通勤手当の合計から、健保・厚年それぞれの
// 標準報酬月額をプルダウンへ自動反映する（既存の従業員を編集する場合、保存済みの値を
// 表示した後に本人が給与項目を変更した際にも再計算されるよう、各項目の変更時に呼び出す）
function refreshStandardMonthlyDefaults() {
  const baseSalary = getNumInputValue('baseSalary');
  const fixedOvertimeAmount = document.getElementById('fixedOvertimeEnabled').value === 'yes' ? getNumInputValue('fixedOvertimeAmount') : 0;
  const allowancesTotal = sumNonExcludedFromSocialInsurance(collectAllowancesFromForm());
  const commuteAllowance = getNumInputValue('commuteAllowance');
  const total = computeStandardMonthlyBase(baseSalary, fixedOvertimeAmount, allowancesTotal, commuteAllowance);
  setStandardMonthlyValue('healthStandardMonthly', 'healthStandardMonthlyCustom', 'healthStandardMonthlyCustomWrap',
    lookupStandardMonthlyAmount(total, HEALTH_STANDARD_BRACKETS), HEALTH_STANDARD_BRACKETS);
  setStandardMonthlyValue('pensionStandardMonthly', 'pensionStandardMonthlyCustom', 'pensionStandardMonthlyCustomWrap',
    lookupStandardMonthlyAmount(total, PENSION_STANDARD_BRACKETS), PENSION_STANDARD_BRACKETS);
}

// ---------------------------------------------------------------------------
// 固定残業代（みなし残業代）
// ---------------------------------------------------------------------------
function applyFixedOvertimeVisibility() {
  const enabled = document.getElementById('fixedOvertimeEnabled').value === 'yes';
  document.getElementById('fixedOvertimeFields').style.display = enabled ? '' : 'none';
}

function renderFixedOvertimeBaseList(selectedKeys) {
  const selected = selectedKeys && selectedKeys.length ? selectedKeys : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES;
  const container = document.getElementById('fixedOvertimeBaseList');
  container.innerHTML = FIXED_OVERTIME_BASE_CATEGORIES.map((c) => `
    <div class="checkbox-row">
      <input type="checkbox" id="fixedOvertimeBase_${c.key}" ${selected.includes(c.key) ? 'checked' : ''}>
      <label for="fixedOvertimeBase_${c.key}">${c.label}</label>
    </div>
  `).join('');
}

function collectFixedOvertimeBaseFromForm() {
  const keys = FIXED_OVERTIME_BASE_CATEGORIES
    .filter((c) => document.getElementById(`fixedOvertimeBase_${c.key}`).checked)
    .map((c) => c.key);
  return keys.length ? keys : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES.slice();
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
// IME変換で漢字に確定した後は「読み」を取得する標準APIが無いため、変換前
// （＝まだ全てかなの間）の入力内容を随時保持しておき、漢字に変換された
// 瞬間にその直前のかな表記を読みとして確定・蓄積していく。
// 「山田」→変換→「太郎」→変換のように姓と名を別々に変換する入力にも
// 対応するため、既に確定した部分（committedRawLen）より後ろの差分だけを
// 都度判定し、確定済みの読み（kanaBuffer）に追記していく。
// ---------------------------------------------------------------------------
const KANA_ONLY_PATTERN = /^[ぁ-ゖァ-ヺー\s]*$/;

function setupFuriganaAutoFill() {
  const nameInput = document.getElementById('empName');
  const kanaInput = document.getElementById('empNameKana');

  let composing = false;
  let kanaBuffer = '';
  let committedRawLen = 0;
  let segmentReading = '';

  function commitSegment(rawLen) {
    if (segmentReading) {
      kanaBuffer += hiraganaToKatakana(segmentReading);
      segmentReading = '';
    }
    committedRawLen = rawLen;
  }

  nameInput.addEventListener('compositionstart', () => {
    composing = true;
    const value = nameInput.value;
    // 手動削除等で確定済み位置とずれている場合は追跡をリセットする
    if (value === '' || value.length < committedRawLen) {
      kanaBuffer = '';
      committedRawLen = 0;
    }
    segmentReading = '';
  });

  nameInput.addEventListener('input', (e) => {
    const value = nameInput.value;
    if (!(composing || e.isComposing)) {
      // IME変換を伴わない手動編集（姓名の区切りスペース等）：
      // 追記分が空白のみであればそのまま読みにも反映し、それ以外は追跡位置だけ同期する
      const manualTail = value.slice(committedRawLen);
      if (manualTail && /^\s+$/.test(manualTail)) {
        kanaBuffer += manualTail;
        kanaInput.value = kanaBuffer;
      }
      committedRawLen = value.length;
      segmentReading = '';
      return;
    }
    const tail = value.slice(committedRawLen);
    if (tail && KANA_ONLY_PATTERN.test(tail)) {
      segmentReading = tail;
      kanaInput.value = hiraganaToKatakana(kanaBuffer + segmentReading);
    } else if (segmentReading) {
      // かな表記から漢字に変換された：直前のかな表記をその区間の読みとして確定
      commitSegment(value.length);
      kanaInput.value = kanaBuffer;
    }
  });

  nameInput.addEventListener('compositionend', () => {
    composing = false;
    commitSegment(nameInput.value.length);
    if (kanaBuffer) {
      kanaInput.value = kanaBuffer;
    }
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
      <div class="allowance-checkboxes">
        <div class="checkbox-row">
          <input type="checkbox" id="allowanceExclude_${seq}" class="allowance-exclude" ${a.excludeFromOvertimeBase ? 'checked' : ''}>
          <label for="allowanceExclude_${seq}">割増賃金の基礎となる賃金から除外</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="allowanceExcludeEmployment_${seq}" class="allowance-exclude-employment" ${a.excludeFromEmploymentInsuranceBase ? 'checked' : ''}>
          <label for="allowanceExcludeEmployment_${seq}">雇用保険料の基礎となる賃金から除外</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="allowanceExcludeSocial_${seq}" class="allowance-exclude-social" ${a.excludeFromSocialInsuranceBase ? 'checked' : ''}>
          <label for="allowanceExcludeSocial_${seq}">社会保険料の基礎となる報酬から除外</label>
        </div>
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
        row.querySelector('.allowance-exclude-employment').checked = false;
        row.querySelector('.allowance-exclude-social').checked = false;
      } else {
        row.remove();
      }
      refreshStandardMonthlyDefaults();
    });
  });
}

function addAllowanceRow() {
  const container = document.getElementById('allowancesList');
  container.insertAdjacentHTML('beforeend', allowanceRowHtml({
    name: '', amount: 0, excludeFromOvertimeBase: false,
    excludeFromEmploymentInsuranceBase: false, excludeFromSocialInsuranceBase: false,
  }));
  attachAllowanceRowEvents();
}

function collectAllowancesFromForm() {
  return Array.from(document.querySelectorAll('#allowancesList .allowance-row')).map((row) => ({
    name: row.querySelector('.allowance-name').value.trim(),
    amount: Number(row.querySelector('.allowance-amount').value.replace(/,/g, '')) || 0,
    excludeFromOvertimeBase: row.querySelector('.allowance-exclude').checked,
    excludeFromEmploymentInsuranceBase: row.querySelector('.allowance-exclude-employment').checked,
    excludeFromSocialInsuranceBase: row.querySelector('.allowance-exclude-social').checked,
  })).filter((a) => a.name || a.amount);
}

// ---------------------------------------------------------------------------
// フォームの初期化・読み込み・保存
// ---------------------------------------------------------------------------
function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = '従業員を新規登録';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('employeeNumber').value = '';
  document.getElementById('department').value = '';
  document.getElementById('empName').value = '';
  document.getElementById('empNameKana').value = '';
  document.getElementById('employeeCode').value = '';
  document.getElementById('employeeLoginPassword').value = '';
  document.getElementById('employmentType').value = '正社員';
  document.getElementById('birthDate').value = '1990-01-01';
  document.getElementById('baseSalary').value = '280,000';
  document.getElementById('fixedOvertimeEnabled').value = 'no';
  document.getElementById('fixedOvertimeAllowanceName').value = '固定残業手当';
  document.getElementById('fixedOvertimeMonthlyHours').value = '30';
  document.getElementById('fixedOvertimeAmount').value = '50,000';
  renderFixedOvertimeBaseList(DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES);
  applyFixedOvertimeVisibility();
  renderAllowanceRows([{ name: 'その他手当', amount: 10000, excludeFromOvertimeBase: false }]);
  document.getElementById('commuteAllowance').value = '10,000';
  document.getElementById('commuteAllowanceExclude').checked = true;
  document.getElementById('dependents').value = '0';
  document.getElementById('taxTable').value = '甲';
  document.getElementById('healthInsuranceNumber').value = '';
  document.getElementById('workStart').value = '09:00';
  document.getElementById('workEnd').value = '18:00';
  document.getElementById('standardDailyHours').value = '8';
  document.getElementById('monthlyStandardHours').value = '160';
  document.getElementById('monthlyStandardDays').value = '20';
  renderOvertimeRatesList(defaultOvertimeRates());
  applyEmploymentTypeLabelToForm();
  updateAgeDisplay();
  refreshStandardMonthlyDefaults();
}

function loadFormFromEmployee(emp) {
  editingId = emp.id;
  document.getElementById('formTitle').textContent = `従業員を編集：${emp.name}`;
  document.getElementById('cancelEditBtn').style.display = '';
  document.getElementById('employeeNumber').value = emp.employeeNumber || '';
  document.getElementById('department').value = emp.department || '';
  document.getElementById('empName').value = emp.name;
  document.getElementById('empNameKana').value = emp.nameKana || '';
  document.getElementById('employeeCode').value = emp.employeeCode || '';
  document.getElementById('employeeLoginPassword').value = emp.loginPassword || '';
  document.getElementById('employmentType').value = emp.employmentType;
  document.getElementById('birthDate').value = emp.birthDate || '1990-01-01';
  document.getElementById('baseSalary').value = formatThousands(emp.baseSalary);
  document.getElementById('fixedOvertimeEnabled').value = emp.fixedOvertimeEnabled ? 'yes' : 'no';
  document.getElementById('fixedOvertimeAllowanceName').value = emp.fixedOvertimeAllowanceName || '固定残業手当';
  document.getElementById('fixedOvertimeMonthlyHours').value = emp.fixedOvertimeMonthlyHours || 0;
  document.getElementById('fixedOvertimeAmount').value = formatThousands(emp.fixedOvertimeAmount || 0);
  renderFixedOvertimeBaseList(emp.fixedOvertimeBaseCategories);
  applyFixedOvertimeVisibility();
  const allowances = emp.allowances && emp.allowances.length
    ? emp.allowances
    : (emp.taxableAllowance ? [{ name: 'その他手当', amount: emp.taxableAllowance, excludeFromOvertimeBase: false }] : []);
  renderAllowanceRows(allowances);
  document.getElementById('commuteAllowance').value = formatThousands(emp.commuteAllowance);
  document.getElementById('commuteAllowanceExclude').checked = emp.commuteAllowanceExcludeFromOvertimeBase !== false;
  document.getElementById('dependents').value = emp.dependents;
  document.getElementById('taxTable').value = emp.taxTable;
  document.getElementById('healthInsuranceNumber').value = emp.healthInsuranceNumber || '';
  setStandardMonthlyValue('healthStandardMonthly', 'healthStandardMonthlyCustom', 'healthStandardMonthlyCustomWrap',
    emp.healthStandardMonthly || emp.baseSalary, HEALTH_STANDARD_BRACKETS);
  setStandardMonthlyValue('pensionStandardMonthly', 'pensionStandardMonthlyCustom', 'pensionStandardMonthlyCustomWrap',
    emp.pensionStandardMonthly || emp.baseSalary, PENSION_STANDARD_BRACKETS);
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
  updateAgeDisplay();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectFormAsEmployee() {
  const name = document.getElementById('empName').value.trim();
  const rates = collectRatesFromForm();
  return Object.assign({
    id: editingId,
    employeeNumber: document.getElementById('employeeNumber').value.trim(),
    department: document.getElementById('department').value.trim(),
    name: name || '(氏名未入力)',
    nameKana: document.getElementById('empNameKana').value.trim(),
    employeeCode: document.getElementById('employeeCode').value.trim(),
    loginPassword: document.getElementById('employeeLoginPassword').value,
    employmentType: document.getElementById('employmentType').value,
    birthDate: document.getElementById('birthDate').value || null,
    baseSalary: getNumInputValue('baseSalary'),
    fixedOvertimeEnabled: document.getElementById('fixedOvertimeEnabled').value === 'yes',
    fixedOvertimeAllowanceName: document.getElementById('fixedOvertimeAllowanceName').value.trim(),
    fixedOvertimeMonthlyHours: Number(document.getElementById('fixedOvertimeMonthlyHours').value) || 0,
    fixedOvertimeAmount: getNumInputValue('fixedOvertimeAmount'),
    fixedOvertimeBaseCategories: collectFixedOvertimeBaseFromForm(),
    allowances: collectAllowancesFromForm(),
    commuteAllowance: getNumInputValue('commuteAllowance'),
    commuteAllowanceExcludeFromOvertimeBase: document.getElementById('commuteAllowanceExclude').checked,
    dependents: Number(document.getElementById('dependents').value) || 0,
    taxTable: document.getElementById('taxTable').value,
    healthInsuranceNumber: document.getElementById('healthInsuranceNumber').value.trim(),
    healthStandardMonthly: getStandardMonthlyValue('healthStandardMonthly', 'healthStandardMonthlyCustom'),
    pensionStandardMonthly: getStandardMonthlyValue('pensionStandardMonthly', 'pensionStandardMonthlyCustom'),
    workStart: document.getElementById('workStart').value || '09:00',
    workEnd: document.getElementById('workEnd').value || '18:00',
    standardDailyHours: Number(document.getElementById('standardDailyHours').value) || 8,
    monthlyStandardHours: Number(document.getElementById('monthlyStandardHours').value) || 160,
    monthlyStandardDays: Number(document.getElementById('monthlyStandardDays').value) || 20,
  }, rates);
}

async function renderEmployeeTable() {
  const employees = await listEmployees();
  const tbody = document.querySelector('#employeeTable tbody');
  tbody.innerHTML = '';
  document.getElementById('emptyState').style.display = employees.length ? 'none' : '';
  document.getElementById('employeeTable').style.display = employees.length ? '' : 'none';

  for (const emp of employees) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(emp.employeeNumber)}</td>
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
    btn.addEventListener('click', async () => {
      const emp = await getEmployee(btn.dataset.id);
      if (emp) loadFormFromEmployee(emp);
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const emp = await getEmployee(btn.dataset.id);
      if (!emp) return;
      const ok = confirm(`「${emp.name}」を削除します。この従業員に紐づく勤怠・給与・賞与の記録もすべて削除されます。よろしいですか？`);
      if (!ok) return;
      await deleteEmployee(emp.id);
      if (editingId === emp.id) resetForm();
      await renderEmployeeTable();
    });
  });
}

document.getElementById('employmentType').addEventListener('change', applyEmploymentTypeLabelToForm);
document.getElementById('birthDate').addEventListener('change', updateAgeDisplay);
document.getElementById('fixedOvertimeEnabled').addEventListener('change', applyFixedOvertimeVisibility);
document.getElementById('addAllowanceBtn').addEventListener('click', addAllowanceRow);

document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!document.getElementById('empName').value.trim()) {
    alert('氏名を入力してください。');
    return;
  }
  if (!validateAllRateFields()) {
    alert('割増率が法定の下限を下回っている項目があります。赤字のエラーを確認し、修正してください。');
    return;
  }
  const emp = collectFormAsEmployee();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    await saveEmployee(emp);
    resetForm();
    await renderEmployeeTable();
  } catch (e) {
    alert('保存に失敗しました：' + e.message);
  } finally {
    btn.disabled = false;
  }
});
document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

['baseSalary', 'fixedOvertimeAmount', 'commuteAllowance', 'healthStandardMonthlyCustom', 'pensionStandardMonthlyCustom'].forEach(attachThousandsFormatting);
setupFuriganaAutoFill();
startAgeAutoUpdate();
populateStandardMonthlySelect('healthStandardMonthly', HEALTH_STANDARD_BRACKETS);
populateStandardMonthlySelect('pensionStandardMonthly', PENSION_STANDARD_BRACKETS);

document.getElementById('healthStandardMonthly').addEventListener('change', () => toggleStandardMonthlyCustomWrap('healthStandardMonthly', 'healthStandardMonthlyCustomWrap'));
document.getElementById('pensionStandardMonthly').addEventListener('change', () => toggleStandardMonthlyCustomWrap('pensionStandardMonthly', 'pensionStandardMonthlyCustomWrap'));

// 基本給・固定残業代・各種手当・通勤手当のいずれかが変わるたびに（入力中もリアル
// タイムに）標準報酬月額のプルダウンを自動で再計算する
['baseSalary', 'fixedOvertimeAmount'].forEach((id) => {
  document.getElementById(id).addEventListener('input', refreshStandardMonthlyDefaults);
});
document.getElementById('fixedOvertimeEnabled').addEventListener('change', refreshStandardMonthlyDefaults);
document.getElementById('commuteAllowance').addEventListener('input', refreshStandardMonthlyDefaults);
document.getElementById('allowancesList').addEventListener('input', (e) => {
  if (e.target.classList.contains('allowance-amount')) refreshStandardMonthlyDefaults();
});
document.getElementById('allowancesList').addEventListener('change', (e) => {
  if (e.target.classList.contains('allowance-exclude-social')) refreshStandardMonthlyDefaults();
});
document.getElementById('addAllowanceBtn').addEventListener('click', refreshStandardMonthlyDefaults);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('employees.html');
  renderNavbarUser(user);
  resetForm();
  await renderEmployeeTable();
})();
