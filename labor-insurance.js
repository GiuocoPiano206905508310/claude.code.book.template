// ============================================================================
// 労働保険 年度更新画面のロジック
// ============================================================================

function renderOfficeInfoGrid(company) {
  const info = (company && company.laborInsuranceInfo) || {};
  const numberText = laborInsuranceNumberText(info);
  renderInfoTiles('officeInfoGrid', [
    ['労働保険番号', numberText || '（会社マスタ管理で未入力）'],
    ['事業の名称', company.companyName || '（会社マスタ管理で未入力）'],
    ['事業所の所在地', info.address || '（未入力）'],
    ['電話番号', info.phone || '（未入力）'],
  ]);
}

function renderTotalsGrid(summary) {
  renderInfoTiles('totalsGrid', [
    ['常時使用労働者数（労災保険対象者数）', `${summary.laborInsuredAverage} 人`],
    ['雇用保険被保険者数', `${summary.employmentInsuredAverage} 人`],
    ['労災保険 対象賃金総額（千円未満切捨て）', `${formatThousands(summary.laborInsuranceThousandYen)} 千円`],
    ['雇用保険 対象賃金総額（千円未満切捨て）', `${formatThousands(summary.employmentInsuranceThousandYen)} 千円`],
    ['一般拠出金 算定基礎額（千円未満切捨て）', `${formatThousands(summary.generalContributionThousandYen)} 千円`],
  ]);
}

function ymShortLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

function renderMonthlyTable(summary) {
  const tbody = document.getElementById('monthlyTableBody');
  tbody.innerHTML = summary.monthRows.map((row) => `
    <tr>
      <td>${ymShortLabel(row.paymentYm)}</td>
      <td class="num">${row.category1.count} 人</td>
      <td class="num">${formatThousands(row.category1.wage)} 円</td>
      <td class="num">${row.category3.count} 人</td>
      <td class="num">${formatThousands(row.category3.wage)} 円</td>
      <td class="num">${row.category4.count} 人</td>
      <td class="num">${formatThousands(row.category4.wage)} 円</td>
      <td class="num">${row.category7.count} 人</td>
      <td class="num">${formatThousands(row.category7.wage)} 円</td>
    </tr>
  `).join('');
}

function renderBonusTable(summary) {
  const tbody = document.getElementById('bonusTableBody');
  const empty = document.getElementById('bonusEmptyState');
  empty.style.display = summary.bonusRows.length ? 'none' : '';
  tbody.innerHTML = summary.bonusRows.map((row) => `
    <tr>
      <td>${ymShortLabel(row.ym)}</td>
      <td class="num">${formatThousands(row.category4Wage)} 円</td>
      <td class="num">${formatThousands(row.category7Wage)} 円</td>
    </tr>
  `).join('');
}

let currentCompany = null;
let currentSummary = null;

async function loadSummary() {
  const year = Number(document.getElementById('fiscalYear').value);
  showExportStatus('excelStatus', '', false);
  document.getElementById('excelBtn').disabled = true;

  const summary = await computeLaborInsuranceSummary(year, currentCompany);
  currentSummary = summary;

  const hasAnyData = summary.totalCategory4.wage > 0 || summary.totalCategory7.wage > 0;
  document.getElementById('summaryEmptyState').style.display = hasAnyData ? 'none' : '';
  document.getElementById('excelBtn').disabled = !hasAnyData;

  renderTotalsGrid(summary);
  renderMonthlyTable(summary);
  renderBonusTable(summary);
}

document.getElementById('fiscalYear').addEventListener('change', loadSummary);

document.getElementById('excelBtn').addEventListener('click', async () => {
  if (!currentSummary) return;
  const btn = document.getElementById('excelBtn');
  btn.disabled = true;
  showExportStatus('excelStatus', 'Excelを作成しています…', false);
  try {
    const values = buildLaborInsuranceFormValues(currentSummary, currentCompany);
    const { blob } = await fillXlsxTemplate(CHINGIN_SHUKEIHYO_FORM.templateUrl, values);
    downloadBlob(blob, `賃金集計表_令和${toReiwaYear(currentSummary.year)}年度.xlsx`);
    showExportStatus('excelStatus', '賃金集計表のExcelをダウンロードしました。', false);
  } catch (e) {
    showExportStatus('excelStatus', 'Excelの作成に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('labor-insurance.html');
  renderNavbarUser(user);

  currentCompany = await getCompany();
  renderOfficeInfoGrid(currentCompany);

  // 対象年度の選択肢（年度は4月始まりのため、今年の1〜3月は前年度扱いになる）
  const now = new Date();
  const currentFiscalYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const yearSelect = document.getElementById('fiscalYear');
  for (let y = currentFiscalYear; y >= currentFiscalYear - 4; y--) {
    const option = document.createElement('option');
    option.value = String(y);
    option.textContent = `令和${toReiwaYear(y)}年度（${y}年4月〜${y + 1}年3月）`;
    yearSelect.appendChild(option);
  }

  await loadSummary();
})();
