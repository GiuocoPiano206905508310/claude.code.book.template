// ============================================================================
// 会社マスタ管理画面のロジック（全従業員共通の保険料率設定）
// ============================================================================

renderNavbar('company.html');

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

function loadFormFromCompany() {
  const company = getCompany();
  document.getElementById('healthInsuranceType').value = company.healthInsuranceType;
  populatePrefectureSelect('prefecture', company.prefecture);
  populateIndustrySelect('industryType', company.industryType);
  applyHealthInsuranceTypeToForm();
  document.getElementById('healthRate').value = Number(company.healthRate).toFixed(2);
  document.getElementById('careRate').value = Number(company.careRate).toFixed(2);
  document.getElementById('pensionRate').value = Number(company.pensionRate).toFixed(2);
  document.getElementById('employmentRate').value = Number(company.employmentRate).toFixed(2);
}

function collectFormAsCompany() {
  return {
    healthInsuranceType: document.getElementById('healthInsuranceType').value,
    prefecture: document.getElementById('prefecture').value,
    healthRate: Number(document.getElementById('healthRate').value) || 0,
    careRate: Number(document.getElementById('careRate').value) || 0,
    pensionRate: Number(document.getElementById('pensionRate').value) || 0,
    industryType: document.getElementById('industryType').value,
    employmentRate: Number(document.getElementById('employmentRate').value) || 0,
  };
}

document.getElementById('prefecture').addEventListener('change', applyPrefectureRateToForm);
document.getElementById('healthInsuranceType').addEventListener('change', applyHealthInsuranceTypeToForm);
document.getElementById('industryType').addEventListener('change', applyIndustryRateToForm);

document.getElementById('saveBtn').addEventListener('click', () => {
  saveCompany(collectFormAsCompany());
  showExportStatus('saveStatus', '会社マスタ情報を保存しました。', false);
});

loadFormFromCompany();
