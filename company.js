// ============================================================================
// 会社マスタ管理画面のロジック（本社・支社ごとの保険料率設定）
// ============================================================================

// ---------------------------------------------------------------------------
// 支社選択
// ---------------------------------------------------------------------------
let companyBranches = [];
let currentBranchId = null;
// 一括操作でチェックされている支社のID。一覧を再描画しても選択状態を保つ
const selectedBranchIds = new Set();
// 一括編集中の支社ID（配列）。単一支社の編集中・未編集の場合はnull
let bulkEditBranchIds = null;

function renderBranchList() {
  const tbody = document.querySelector('#branchListTable tbody');
  tbody.innerHTML = companyBranches.map((b, i) => `
    <tr data-branch-id="${b.id}"${b.id === currentBranchId ? ' style="background:var(--surface-line);"' : ''}>
      <td class="branch-select-col">
        <input type="checkbox" data-action="select-branch" data-id="${b.id}"
          title="一括操作の対象にする"${selectedBranchIds.has(b.id) ? ' checked' : ''}>
      </td>
      <td>
        <span class="branch-no">${i + 1}</span>
        <button type="button" class="btn btn-sm btn-outline" data-action="move-up" data-id="${b.id}" title="上へ移動"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="btn btn-sm btn-outline" data-action="move-down" data-id="${b.id}" title="下へ移動"${i === companyBranches.length - 1 ? ' disabled' : ''}>▼</button>
      </td>
      <td>${escapeHtml(b.branchName)}</td>
      <td>${b.isHeadOffice ? '本社' : '支社'}</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="edit-branch" data-id="${b.id}">編集</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-branch" data-id="${b.id}"${b.isHeadOffice ? ' disabled title="本社は削除できません"' : ''}>削除</button>
      </td>
    </tr>
  `).join('');
}

// チェック件数の表示・一括操作ボタンの活性・全選択チェックの状態を更新する
function updateBranchBulkUi() {
  const count = selectedBranchIds.size;
  document.getElementById('branchSelectedCount').textContent = `選択中：${count}件`;
  document.getElementById('bulkEditBranchBtn').disabled = count === 0;
  // 本社は削除できないため、削除対象になる支社が1件も無い場合は押せないようにする
  const deletableCount = companyBranches.filter((b) => selectedBranchIds.has(b.id) && !b.isHeadOffice).length;
  document.getElementById('bulkDeleteBranchBtn').disabled = deletableCount === 0;

  const selectAll = document.getElementById('branchSelectAll');
  selectAll.checked = companyBranches.length > 0 && count === companyBranches.length;
  selectAll.indeterminate = count > 0 && count < companyBranches.length;
}

// 削除された支社などが選択に残らないようにする
function pruneSelectedBranchIds() {
  const existing = new Set(companyBranches.map((b) => b.id));
  [...selectedBranchIds].forEach((id) => { if (!existing.has(id)) selectedBranchIds.delete(id); });
}

// 隣接する支社とNo.（並び順）を入れ替える
async function moveBranch(branchId, direction) {
  const idx = companyBranches.findIndex((b) => b.id === branchId);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= companyBranches.length) return;
  const current = companyBranches[idx];
  const target = companyBranches[targetIdx];
  const currentOrder = current.sortOrder;
  const targetOrder = target.sortOrder;
  try {
    await updateBranchSortOrder(current.id, targetOrder);
    await updateBranchSortOrder(target.id, currentOrder);
    await refreshBranchList(currentBranchId);
  } catch (e) {
    showExportStatus('branchStatus', '並び順の変更に失敗しました：' + e.message, true);
  }
}

async function refreshBranchList(selectId) {
  companyBranches = await listBranches();
  currentBranchId = selectId || (companyBranches.find((b) => b.isHeadOffice) || companyBranches[0]).id;
  pruneSelectedBranchIds();
  renderBranchList();
  updateBranchBulkUi();
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
  const enabledCheckbox = row.querySelector('.rounding-kind-enabled');
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
  enabledCheckbox.checked = rule.enabled !== false;
  applyRoundingKindEnabledToRow(row);
}

function getRoundingRowValue(kind) {
  const row = document.querySelector(`#roundingRulesTable tr[data-kind="${kind}"]`);
  const enabledCheckbox = row.querySelector('.rounding-kind-enabled');
  const unitSelect = row.querySelector('.rounding-unit-select');
  const customInput = row.querySelector('.rounding-custom-input');
  const methodSelect = row.querySelector('.rounding-method-select');
  const minutes = unitSelect.value === 'custom' ? (Number(customInput.value) || 1) : Number(unitSelect.value);
  return { minutes, method: methodSelect.value === 'down' ? 'down' : 'up', enabled: enabledCheckbox.checked };
}

// 項目ごとの「状態」スイッチがオフのとき、その行の丸め単位・計算方法の選択を
// 編集不可にする（実際に丸めが適用されないことが見た目でも分かるように）
function applyRoundingKindEnabledToRow(row) {
  const enabled = row.querySelector('.rounding-kind-enabled').checked;
  const unitSelect = row.querySelector('.rounding-unit-select');
  const customInput = row.querySelector('.rounding-custom-input');
  const methodSelect = row.querySelector('.rounding-method-select');
  unitSelect.disabled = !enabled;
  customInput.disabled = !enabled;
  methodSelect.disabled = !enabled;
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
  document.querySelectorAll('#roundingRulesTable .rounding-kind-enabled').forEach((checkbox) => {
    checkbox.addEventListener('change', () => applyRoundingKindEnabledToRow(checkbox.closest('tr')));
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
  document.getElementById('paycheckPaymentMonth').value = company.paycheckPaymentMonth === 'current' ? 'current' : 'next';
  document.getElementById('paymentDateHolidayAdjust').value = ['before', 'after'].includes(company.paymentDateHolidayAdjust)
    ? company.paymentDateHolidayAdjust : 'none';
  const laborInfo = company.laborInsuranceInfo || defaultLaborInsuranceInfo();
  document.getElementById('laborInsurancePrefecture').value = laborInfo.prefectureCode || '';
  document.getElementById('laborInsuranceOfficeCode').value = laborInfo.officeCode || '';
  document.getElementById('laborInsuranceJurisdiction').value = laborInfo.jurisdiction || '';
  document.getElementById('laborInsuranceBaseNumber').value = laborInfo.baseNumber || '';
  document.getElementById('laborInsuranceBranchNumber').value = laborInfo.branchNumber || '';
  document.getElementById('laborInsuranceZipCode').value = laborInfo.zipCode || '';
  document.getElementById('laborInsuranceAddress').value = laborInfo.address || '';
  document.getElementById('laborInsurancePhone').value = laborInfo.phone || '';
  document.getElementById('laborInsuranceBusinessDescription').value = laborInfo.businessDescription || '';
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
  document.getElementById('scheduledStartRounding').checked = !!company.scheduledStartRounding;

  const overtimeRules = company.overtimeFractionRules || {};
  document.getElementById('overtimeFractionMonthlyHours').checked = !!overtimeRules.monthlyHoursRounding;
  document.getElementById('overtimeFractionHourlyWage').checked = !!overtimeRules.hourlyWageRounding;
  document.getElementById('overtimeFractionMonthlyPay').checked = !!overtimeRules.monthlyPayRounding;

  const paymentRules = company.monthlyPaymentFractionRules || {};
  document.getElementById('paymentFractionRound100').checked = !!paymentRules.round100;
  document.getElementById('paymentFractionCarryOver1000').checked = !!paymentRules.carryOver1000;

  await renderCompanyHistory();
}

async function renderCompanyHistory() {
  const list = document.getElementById('companyHistoryList');
  const empty = document.getElementById('companyHistoryEmptyState');
  if (!currentBranchId) { list.innerHTML = ''; empty.style.display = ''; return; }
  const history = await listChangeHistory('company_branch', currentBranchId);
  empty.style.display = history.length ? 'none' : '';
  list.innerHTML = renderChangeHistoryList(history);
}

function collectFormAsCompany() {
  const branch = companyBranches.find((b) => b.id === currentBranchId);
  return {
    id: currentBranchId,
    branchName: document.getElementById('branchNameInput').value.trim() || '本社',
    isHeadOffice: branch ? branch.isHeadOffice : false,
    sortOrder: branch ? branch.sortOrder : undefined,
    overtimeRates: collectRatesFromForm(),
    statutoryHolidayWeekday: Number(document.getElementById('statutoryHolidayWeekday').value),
    scheduledHolidayWeekday: Number(document.getElementById('scheduledHolidayWeekday').value),
    weekStartDay: Number(document.getElementById('weekStartDay').value),
    weeklyOvertimeThreshold: Number(document.getElementById('weeklyOvertimeThreshold').value),
    paycheckClosingDay: document.getElementById('paycheckClosingDay').value,
    paycheckPaymentDay: document.getElementById('paycheckPaymentDay').value,
    paycheckPaymentMonth: document.getElementById('paycheckPaymentMonth').value,
    paymentDateHolidayAdjust: document.getElementById('paymentDateHolidayAdjust').value,
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
    scheduledStartRounding: document.getElementById('scheduledStartRounding').checked,
    overtimeFractionRules: {
      monthlyHoursRounding: document.getElementById('overtimeFractionMonthlyHours').checked,
      hourlyWageRounding: document.getElementById('overtimeFractionHourlyWage').checked,
      monthlyPayRounding: document.getElementById('overtimeFractionMonthlyPay').checked,
    },
    monthlyPaymentFractionRules: {
      round100: document.getElementById('paymentFractionRound100').checked,
      carryOver1000: document.getElementById('paymentFractionCarryOver1000').checked,
    },
    laborInsuranceInfo: {
      prefectureCode: document.getElementById('laborInsurancePrefecture').value.trim(),
      officeCode: document.getElementById('laborInsuranceOfficeCode').value.trim(),
      jurisdiction: document.getElementById('laborInsuranceJurisdiction').value.trim(),
      baseNumber: document.getElementById('laborInsuranceBaseNumber').value.trim(),
      branchNumber: document.getElementById('laborInsuranceBranchNumber').value.trim(),
      zipCode: document.getElementById('laborInsuranceZipCode').value.trim(),
      address: document.getElementById('laborInsuranceAddress').value.trim(),
      phone: document.getElementById('laborInsurancePhone').value.trim(),
      businessDescription: document.getElementById('laborInsuranceBusinessDescription').value.trim(),
    },
  };
}

document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);
document.getElementById('roundingEnabled').addEventListener('change', applyRoundingEnabledToForm);
attachRoundingRowEvents();

// ---------------------------------------------------------------------------
// 編集ロック: 支社選択の「編集」を押すまで入力・変更できないようにする
// ---------------------------------------------------------------------------
function setEditMode(editing) {
  document.querySelectorAll('#companyFormCard select, #companyFormCard input').forEach((el) => {
    el.disabled = !editing;
  });
  // 項目ごとの「状態」スイッチがオフの行は、編集モードに入っても丸め単位・
  // 計算方法の選択を編集不可のままにする
  document.querySelectorAll('#roundingRulesTable tr[data-kind]').forEach((row) => applyRoundingKindEnabledToRow(row));
  document.getElementById('editModeNote').style.display = editing ? '' : 'none';
  document.getElementById('editSaveRow').style.display = editing ? '' : 'none';
  applyBulkEditModeToForm();
}

// 一括編集中は、支社名の欄だけは編集できないようにする（各支社の名称は
// それぞれ元のまま残し、名称以外の設定だけをまとめて反映するため）
function applyBulkEditModeToForm() {
  const note = document.getElementById('bulkEditNote');
  const nameInput = document.getElementById('branchNameInput');
  if (!bulkEditBranchIds) {
    note.style.display = 'none';
    note.textContent = '';
    return;
  }
  const names = companyBranches.filter((b) => bulkEditBranchIds.includes(b.id)).map((b) => b.branchName);
  note.textContent = `一括編集中：${names.length}件（${names.join('、')}）。`
    + '「保存する」を押すと、支社名を除くすべての設定がこれらの支社に同じ内容で反映されます。';
  note.style.display = '';
  nameInput.disabled = true;
}

// 一括編集を解除して通常の編集に戻す
function clearBulkEditMode() {
  bulkEditBranchIds = null;
  applyBulkEditModeToForm();
}

document.getElementById('cancelEditBtn').addEventListener('click', async () => {
  clearBulkEditMode();
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

  if (bulkEditBranchIds) {
    const targets = companyBranches.filter((b) => bulkEditBranchIds.includes(b.id));
    const ok = confirm(`次の${targets.length}件の支社に、支社名を除く同じ設定を反映します。\n\n`
      + targets.map((b) => `・${b.branchName}`).join('\n') + '\n\nよろしいですか？');
    if (!ok) return;
    btn.disabled = true;
    const form = collectFormAsCompany();
    const failed = [];
    try {
      for (const branch of targets) {
        // 支社名・本社区分・並び順は各支社のものを維持し、それ以外を上書きする
        const merged = Object.assign({}, form, {
          id: branch.id,
          branchName: branch.branchName,
          isHeadOffice: branch.isHeadOffice,
          sortOrder: branch.sortOrder,
        });
        try {
          await saveBranch(merged);
        } catch (err) {
          failed.push(`${branch.branchName}（${err.message}）`);
        }
      }
      clearBulkEditMode();
      await refreshBranchList(currentBranchId);
      await loadFormFromCompany();
      setEditMode(false);
      if (failed.length) {
        showExportStatus('saveStatus', `${targets.length - failed.length}件に反映しましたが、次の支社で失敗しました：` + failed.join('、'), true);
      } else {
        showExportStatus('saveStatus', `${targets.length}件の支社に設定を反映しました。`, false);
      }
    } finally {
      btn.disabled = false;
    }
    return;
  }

  btn.disabled = true;
  try {
    await saveBranch(collectFormAsCompany());
    await refreshBranchList(currentBranchId);
    await renderCompanyHistory();
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
  clearBulkEditMode();
  currentBranchId = branchId;
  renderBranchList();
  await loadFormFromCompany();
  setEditMode(true);
  showExportStatus('saveStatus', '', false);
  showExportStatus('branchStatus', '', false);
}

document.querySelector('#branchListTable tbody').addEventListener('change', (e) => {
  const checkbox = e.target.closest('[data-action="select-branch"]');
  if (!checkbox) return;
  if (checkbox.checked) selectedBranchIds.add(checkbox.dataset.id);
  else selectedBranchIds.delete(checkbox.dataset.id);
  updateBranchBulkUi();
});

document.getElementById('branchSelectAll').addEventListener('change', (e) => {
  selectedBranchIds.clear();
  if (e.target.checked) companyBranches.forEach((b) => selectedBranchIds.add(b.id));
  renderBranchList();
  updateBranchBulkUi();
});

document.querySelector('#branchListTable tbody').addEventListener('click', async (e) => {
  const moveUpBtn = e.target.closest('[data-action="move-up"]');
  if (moveUpBtn) {
    moveUpBtn.disabled = true;
    await moveBranch(moveUpBtn.dataset.id, 'up');
    return;
  }
  const moveDownBtn = e.target.closest('[data-action="move-down"]');
  if (moveDownBtn) {
    moveDownBtn.disabled = true;
    await moveBranch(moveDownBtn.dataset.id, 'down');
    return;
  }
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

// チェックした支社をまとめて編集する（保存時に同じ設定をすべてへ反映する）
document.getElementById('bulkEditBranchBtn').addEventListener('click', async () => {
  const targets = companyBranches.filter((b) => selectedBranchIds.has(b.id));
  if (!targets.length) {
    showExportStatus('branchStatus', '一括編集する支社にチェックを入れてください。', true);
    return;
  }
  const wasEditing = document.getElementById('editModeNote').style.display !== 'none';
  if (wasEditing && !confirm('編集中の内容は保存されていません。破棄して一括編集を始めますか？')) return;

  bulkEditBranchIds = targets.map((b) => b.id);
  // 先頭の支社の設定を初期値としてフォームに表示する
  currentBranchId = targets[0].id;
  renderBranchList();
  await loadFormFromCompany();
  setEditMode(true);
  showExportStatus('saveStatus', '', false);
  showExportStatus('branchStatus', `${targets.length}件の支社を一括編集します。設定を変更して「保存する」を押してください。`, false);
  document.getElementById('companyFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// チェックした支社をまとめて削除する（本社は削除対象から除外する）
document.getElementById('bulkDeleteBranchBtn').addEventListener('click', async () => {
  const selected = companyBranches.filter((b) => selectedBranchIds.has(b.id));
  const targets = selected.filter((b) => !b.isHeadOffice);
  const skippedHeadOffice = selected.length - targets.length;
  if (!targets.length) {
    showExportStatus('branchStatus', '削除できる支社が選択されていません（本社は削除できません）。', true);
    return;
  }
  const ok = confirm(`次の${targets.length}件の支社を削除します。\n\n`
    + targets.map((b) => `・${b.branchName}`).join('\n')
    + '\n\nこれらの支社に所属している従業員は、所属支社が未設定になります。よろしいですか？'
    + (skippedHeadOffice ? '\n※ 本社は削除できないため対象から除きます。' : ''));
  if (!ok) return;

  const btn = document.getElementById('bulkDeleteBranchBtn');
  btn.disabled = true;
  const failed = [];
  let currentDeleted = false;
  for (const branch of targets) {
    try {
      await deleteBranch(branch.id);
      selectedBranchIds.delete(branch.id);
      if (branch.id === currentBranchId) currentDeleted = true;
    } catch (err) {
      failed.push(`${branch.branchName}（${err.message}）`);
    }
  }
  clearBulkEditMode();
  await refreshBranchList(currentDeleted ? null : currentBranchId);
  if (currentDeleted) {
    await loadFormFromCompany();
    setEditMode(false);
  }
  if (failed.length) {
    showExportStatus('branchStatus', `${targets.length - failed.length}件を削除しましたが、次の支社で失敗しました：` + failed.join('、'), true);
  } else {
    showExportStatus('branchStatus', `${targets.length}件の支社を削除しました。`, false);
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
