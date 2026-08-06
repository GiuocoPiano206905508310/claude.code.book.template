// ============================================================================
// 会社マスタ管理画面のロジック（本社・支社ごとの保険料率設定）
// ============================================================================

// ---------------------------------------------------------------------------
// 支社選択
// ---------------------------------------------------------------------------
let companyBranches = [];
let currentBranchId = null;

function renderBranchList() {
  const tbody = document.querySelector('#branchListTable tbody');
  tbody.innerHTML = companyBranches.map((b, i) => `
    <tr data-branch-id="${b.id}"${b.id === currentBranchId ? ' style="background:var(--surface-line);"' : ''}>
      <td>${i + 1}</td>
      <td>${escapeHtml(b.branchName)}</td>
      <td>${b.isHeadOffice ? '本社' : '支社'}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="edit-branch" data-id="${b.id}">編集</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-branch" data-id="${b.id}"${b.isHeadOffice ? ' disabled title="本社は削除できません"' : ''}>削除</button>
      </td>
    </tr>
  `).join('');
}

async function refreshBranchList(selectId) {
  companyBranches = await listBranches();
  currentBranchId = selectId || (companyBranches.find((b) => b.isHeadOffice) || companyBranches[0]).id;
  renderBranchList();
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

// ---------------------------------------------------------------------------
// 勤怠丸め設定（出勤・退勤・休憩開始・休憩終了）
// ---------------------------------------------------------------------------
const ROUNDING_PRESET_MINUTES = ['5', '10', '15', '20', '30'];
const ROUNDING_KINDS = ['clockIn', 'clockOut', 'breakStart', 'breakEnd'];

function applyRoundingEnabledToForm() {
  const enabled = document.getElementById('roundingEnabled').value === 'true';
  document.getElementById('roundingRulesSection').style.display = enabled ? '' : 'none';
}

function setRoundingRowValue(kind, rule) {
  const row = document.querySelector(`#roundingRulesTable tr[data-kind="${kind}"]`);
  if (!row || !rule) return;
  const unitSelect = row.querySelector('.rounding-unit-select');
  const customInput = row.querySelector('.rounding-custom-input');
  const methodSelect = row.querySelector('.rounding-method-select');
  const minutes = String(rule.minutes || 15);
  if (ROUNDING_PRESET_MINUTES.includes(minutes)) {
    unitSelect.value = minutes;
    customInput.style.display = 'none';
  } else {
    unitSelect.value = 'custom';
    customInput.style.display = '';
    customInput.value = minutes;
  }
  methodSelect.value = rule.method === 'down' ? 'down' : 'up';
}

function getRoundingRowValue(kind) {
  const row = document.querySelector(`#roundingRulesTable tr[data-kind="${kind}"]`);
  const unitSelect = row.querySelector('.rounding-unit-select');
  const customInput = row.querySelector('.rounding-custom-input');
  const methodSelect = row.querySelector('.rounding-method-select');
  const minutes = unitSelect.value === 'custom' ? (Number(customInput.value) || 1) : Number(unitSelect.value);
  return { minutes, method: methodSelect.value === 'down' ? 'down' : 'up' };
}

function attachRoundingRowEvents() {
  document.querySelectorAll('#roundingRulesTable .rounding-unit-select').forEach((select) => {
    select.addEventListener('change', () => {
      const customInput = select.closest('tr').querySelector('.rounding-custom-input');
      if (select.value === 'custom') {
        customInput.style.display = '';
        if (!customInput.value) customInput.value = '15';
      } else {
        customInput.style.display = 'none';
      }
    });
  });
}

async function loadFormFromCompany() {
  const company = await getCompany(currentBranchId);
  document.getElementById('branchNameInput').value = company.branchName || '';
  document.getElementById('statutoryHolidayWeekday').value = String(company.statutoryHolidayWeekday);
  document.getElementById('scheduledHolidayWeekday').value = String(company.scheduledHolidayWeekday);
  document.getElementById('weekStartDay').value = String(company.weekStartDay);
  document.getElementById('weeklyOvertimeThreshold').value = String(company.weeklyOvertimeThreshold);
  populateDayOfMonthSelect('paycheckClosingDay', String(company.paycheckClosingDay));
  populateDayOfMonthSelect('paycheckPaymentDay', String(company.paycheckPaymentDay));
  document.getElementById('healthInsuranceType').value = company.healthInsuranceType;
  populatePrefectureSelect('prefecture', company.prefecture);
  populateIndustrySelect('industryType', company.industryType);
  applyHealthInsuranceTypeToForm();
  document.getElementById('healthRate').value = Number(company.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(company.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(company.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(company.employmentRate).toFixed(2);
  document.getElementById('calcMethod').value = company.calcMethod;

  renderOvertimeRatesList(company.overtimeRates || defaultOvertimeRates());

  document.getElementById('roundingEnabled').value = String(!!company.roundingEnabled);
  applyRoundingEnabledToForm();
  const rules = company.roundingRules || defaultRoundingRules();
  ROUNDING_KINDS.forEach((kind) => setRoundingRowValue(kind, rules[kind]));

  const overtimeRules = company.overtimeFractionRules || {};
  document.getElementById('overtimeFractionMonthlyHours').checked = !!overtimeRules.monthlyHoursRounding;
  document.getElementById('overtimeFractionHourlyWage').checked = !!overtimeRules.hourlyWageRounding;
  document.getElementById('overtimeFractionMonthlyPay').checked = !!overtimeRules.monthlyPayRounding;

  const paymentRules = company.monthlyPaymentFractionRules || {};
  document.getElementById('paymentFractionRound100').checked = !!paymentRules.round100;
  document.getElementById('paymentFractionCarryOver1000').checked = !!paymentRules.carryOver1000;
}

function collectFormAsCompany() {
  const branch = companyBranches.find((b) => b.id === currentBranchId);
  return {
    id: currentBranchId,
    branchName: document.getElementById('branchNameInput').value.trim() || '本社',
    isHeadOffice: branch ? branch.isHeadOffice : false,
    overtimeRates: collectRatesFromForm(),
    statutoryHolidayWeekday: Number(document.getElementById('statutoryHolidayWeekday').value),
    scheduledHolidayWeekday: Number(document.getElementById('scheduledHolidayWeekday').value),
    weekStartDay: Number(document.getElementById('weekStartDay').value),
    weeklyOvertimeThreshold: Number(document.getElementById('weeklyOvertimeThreshold').value),
    paycheckClosingDay: document.getElementById('paycheckClosingDay').value,
    paycheckPaymentDay: document.getElementById('paycheckPaymentDay').value,
    healthInsuranceType: document.getElementById('healthInsuranceType').value,
    prefecture: document.getElementById('prefecture').value,
    healthRate: Number(document.getElementById('healthRate').value) || 0,
    careRate: Number(document.getElementById('careRate').value) || 0,
    pensionRate: Number(document.getElementById('pensionRate').value) || 0,
    industryType: document.getElementById('industryType').value,
    employmentRate: Number(document.getElementById('employmentRate').value) || 0,
    calcMethod: document.getElementById('calcMethod').value,
    roundingEnabled: document.getElementById('roundingEnabled').value === 'true',
    roundingRules: {
      clockIn: getRoundingRowValue('clockIn'),
      clockOut: getRoundingRowValue('clockOut'),
      breakStart: getRoundingRowValue('breakStart'),
      breakEnd: getRoundingRowValue('breakEnd'),
    },
    overtimeFractionRules: {
      monthlyHoursRounding: document.getElementById('overtimeFractionMonthlyHours').checked,
      hourlyWageRounding: document.getElementById('overtimeFractionHourlyWage').checked,
      monthlyPayRounding: document.getElementById('overtimeFractionMonthlyPay').checked,
    },
    monthlyPaymentFractionRules: {
      round100: document.getElementById('paymentFractionRound100').checked,
      carryOver1000: document.getElementById('paymentFractionCarryOver1000').checked,
    },
  };
}

document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);
document.getElementById('roundingEnabled').addEventListener('change', applyRoundingEnabledToForm);
attachRoundingRowEvents();

// ---------------------------------------------------------------------------
// 編集ロック: 「編集する」を押すまで入力・変更できないようにする
// ---------------------------------------------------------------------------
function setEditMode(editing) {
  document.querySelectorAll('#companyFormCard select, #companyFormCard input').forEach((el) => {
    el.disabled = !editing;
  });
  document.getElementById('editBtn').style.display = editing ? 'none' : '';
  document.getElementById('editModeNote').style.display = editing ? '' : 'none';
  document.getElementById('editSaveRow').style.display = editing ? '' : 'none';
}

document.getElementById('editBtn').addEventListener('click', () => setEditMode(true));

document.getElementById('cancelEditBtn').addEventListener('click', async () => {
  await loadFormFromCompany();
  setEditMode(false);
  showExportStatus('saveStatus', '', false);
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!validateAllRateFields()) {
    alert('割増率が法定の下限を下回っている項目があります。赤字のエラーを確認し、修正してください。');
    return;
  }
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    await saveBranch(collectFormAsCompany());
    await refreshBranchList(currentBranchId);
    showExportStatus('saveStatus', '会社マスタ情報を保存しました。', false);
    setEditMode(false);
  } catch (e) {
    showExportStatus('saveStatus', '保存に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// 支社の切り替え・追加・削除
// ---------------------------------------------------------------------------
async function switchToBranch(branchId) {
  const wasEditing = document.getElementById('editModeNote').style.display !== 'none';
  if (wasEditing && !confirm('編集中の内容は保存されていません。破棄して支社を切り替えますか？')) {
    return;
  }
  currentBranchId = branchId;
  renderBranchList();
  await loadFormFromCompany();
  setEditMode(false);
  showExportStatus('saveStatus', '', false);
  showExportStatus('branchStatus', '', false);
}

document.querySelector('#branchListTable tbody').addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-action="edit-branch"]');
  if (editBtn) {
    await switchToBranch(editBtn.dataset.id);
    return;
  }
  const deleteBtn = e.target.closest('[data-action="delete-branch"]');
  if (deleteBtn) {
    const branch = companyBranches.find((b) => b.id === deleteBtn.dataset.id);
    if (!branch || branch.isHeadOffice) return;
    const ok = confirm(`支社「${branch.branchName}」を削除します。この支社に所属している従業員は所属支社が未設定になります。よろしいですか？`);
    if (!ok) return;
    deleteBtn.disabled = true;
    try {
      await deleteBranch(branch.id);
      const wasCurrent = branch.id === currentBranchId;
      await refreshBranchList(wasCurrent ? null : currentBranchId);
      if (wasCurrent) {
        await loadFormFromCompany();
        setEditMode(false);
      }
      showExportStatus('branchStatus', `支社「${branch.branchName}」を削除しました。`, false);
    } catch (err) {
      showExportStatus('branchStatus', '支社の削除に失敗しました：' + err.message, true);
      deleteBtn.disabled = false;
    }
  }
});

document.getElementById('addBranchBtn').addEventListener('click', async () => {
  const nameInput = document.getElementById('newBranchNameInput');
  const name = nameInput.value.trim();
  if (!name) {
    showExportStatus('branchStatus', '新しい支社名を入力してください。', true);
    return;
  }
  if (companyBranches.some((b) => b.branchName === name)) {
    showExportStatus('branchStatus', `支社名「${name}」は既に登録された支社です。別の名称を入力してください。`, true);
    return;
  }
  const btn = document.getElementById('addBranchBtn');
  btn.disabled = true;
  try {
    const created = await createBranchFromHeadOffice(name);
    nameInput.value = '';
    await refreshBranchList(created.id);
    await loadFormFromCompany();
    setEditMode(false);
    showExportStatus('branchStatus', `支社「${name}」を追加しました（本社の設定をコピーしています）。`, false);
  } catch (e) {
    showExportStatus('branchStatus', '支社の追加に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('company.html');
  renderNavbarUser(user);
  await refreshBranchList();
  await loadFormFromCompany();
  setEditMode(false);
})();
