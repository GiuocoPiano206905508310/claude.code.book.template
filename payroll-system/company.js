// ============================================================================
// 会社マスタ管理画面のロジック（全従業員共通の保険料率設定）
// ============================================================================

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
  const company = await getCompany();
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
  return {
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
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    await saveCompany(collectFormAsCompany());
    showExportStatus('saveStatus', '会社マスタ情報を保存しました。', false);
    setEditMode(false);
  } catch (e) {
    showExportStatus('saveStatus', '保存に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('company.html');
  renderNavbarUser(user);
  await loadFormFromCompany();
  setEditMode(false);
})();
