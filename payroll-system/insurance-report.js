// ============================================================================
// 算定基礎届・月額変更届の作成画面
// 対象者を自動抽出して一覧表示し、日本年金機構の様式（Excel）に差し込んで
// ダウンロードする。
// ============================================================================

let santeiEntries = [];
let geppenNotices = [];
const santeiSelected = new Set();
const geppenSelected = new Set();

function yen(value) {
  return `${formatThousands(Math.round(Number(value) || 0))} 円`;
}

// 選択された対象者を、様式の並び順（画面の表示順）で返す
function selectedItems(items, selected, keyOf) {
  return items.filter((item) => selected.has(keyOf(item)));
}

// 出力する枚数の選択肢（5人ごとに1枚）を更新する
function updateSheetSelect(selectId, count, perSheet) {
  const select = document.getElementById(selectId);
  const sheets = Math.max(1, Math.ceil(count / perSheet));
  const current = Number(select.value) || 1;
  select.innerHTML = '';
  for (let i = 1; i <= sheets; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    const from = (i - 1) * perSheet + 1;
    const to = Math.min(i * perSheet, count);
    option.textContent = count ? `${i}枚目（${from}〜${to}人目）` : `${i}枚目`;
    select.appendChild(option);
  }
  select.value = String(Math.min(current, sheets));
  select.disabled = sheets <= 1;
}

// ---------------------------------------------------------------------------
// 算定基礎届
// ---------------------------------------------------------------------------
function renderSanteiTable() {
  const tbody = document.querySelector('#santeiTable tbody');
  const empty = document.getElementById('santeiEmptyState');
  empty.style.display = santeiEntries.length ? 'none' : '';
  document.getElementById('santeiTable').style.display = santeiEntries.length ? '' : 'none';

  tbody.innerHTML = santeiEntries.map((entry) => {
    const [m1, m2, m3] = entry.months;
    const cell = (m) => {
      if (!m.hasSlip) return '<td class="num is-missing">明細なし</td><td class="num is-missing">—</td>';
      const excluded = !entry.usePrevious && !entry.targetYms.includes(m.ym);
      const cls = excluded ? ' class="num is-excluded"' : ' class="num"';
      return `<td${cls}>${m.basisDays} 日</td><td${cls}>${yen(m.remuneration)}</td>`;
    };
    const gradeText = entry.usePrevious
      ? '従前のまま'
      : `${formatThousands(entry.currentHealthStandardMonthly)}円 → <strong>${formatThousands(entry.newHealthStandardMonthly)}円</strong>`;
    return `
      <tr data-id="${entry.employeeId}">
        <td class="branch-select-col">
          <input type="checkbox" data-action="select-santei" data-id="${entry.employeeId}"
            ${santeiSelected.has(entry.employeeId) ? 'checked' : ''}>
        </td>
        <td>${escapeHtml(entry.employeeName)}</td>
        <td>${escapeHtml(entry.insuranceNumber) || '<span class="is-missing">未登録</span>'}</td>
        <td>${escapeHtml(formatBirthDateForForm(entry.birthDate)) || '<span class="is-missing">未登録</span>'}</td>
        ${cell(m1)}${cell(m2)}${cell(m3)}
        <td class="num">${entry.usePrevious ? '—' : yen(entry.total)}</td>
        <td class="num">${entry.usePrevious ? '—' : yen(entry.averageRemuneration)}</td>
        <td>${gradeText}${entry.note ? `<br><span class="is-note">※ ${escapeHtml(entry.note)}</span>` : ''}</td>
      </tr>
    `;
  }).join('');

  updateSheetSelect('santeiSheet', santeiSelected.size, SANTEI_FORM.perSheet);
  const all = document.getElementById('santeiSelectAll');
  all.checked = santeiEntries.length > 0 && santeiSelected.size === santeiEntries.length;
  all.indeterminate = santeiSelected.size > 0 && santeiSelected.size < santeiEntries.length;
}

async function loadSantei() {
  const year = Number(document.getElementById('santeiYear').value);
  showExportStatus('santeiStatus', '対象者を集計しています…', false);
  try {
    santeiEntries = await listSanteiEntries(year);
    santeiSelected.clear();
    santeiEntries.forEach((e) => santeiSelected.add(e.employeeId));
    renderSanteiTable();
    showExportStatus('santeiStatus', `対象者 ${santeiEntries.length} 名を集計しました。`, false);
  } catch (e) {
    showExportStatus('santeiStatus', '集計に失敗しました：' + e.message, true);
  }
}

async function exportSantei() {
  const targets = selectedItems(santeiEntries, santeiSelected, (e) => e.employeeId);
  if (!targets.length) {
    showExportStatus('santeiStatus', '出力する従業員にチェックを入れてください。', true);
    return;
  }
  const sheet = Number(document.getElementById('santeiSheet').value) || 1;
  const page = targets.slice((sheet - 1) * SANTEI_FORM.perSheet, sheet * SANTEI_FORM.perSheet);
  const btn = document.getElementById('santeiExcelBtn');
  btn.disabled = true;
  showExportStatus('santeiStatus', 'Excelを作成しています…', false);
  try {
    const employee = await getEmployee(page[0].employeeId);
    const company = await getCompany(employee && employee.branchId);
    const values = buildSanteiFormValues(page, company);
    const { blob } = await fillXlsxTemplate(SANTEI_FORM.templateUrl, values);
    const year = document.getElementById('santeiYear').value;
    downloadBlob(blob, `算定基礎届_${year}年_${sheet}枚目.xlsx`);
    showExportStatus('santeiStatus', `${page.length}名分（${sheet}枚目）の算定基礎届をダウンロードしました。`, false);
  } catch (e) {
    showExportStatus('santeiStatus', 'Excelの作成に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// 月額変更届
// ---------------------------------------------------------------------------
function renderGeppenTable() {
  const tbody = document.querySelector('#geppenTable tbody');
  const empty = document.getElementById('geppenEmptyState');
  empty.style.display = geppenNotices.length ? 'none' : '';
  document.getElementById('geppenTable').style.display = geppenNotices.length ? '' : 'none';

  tbody.innerHTML = geppenNotices.map((n) => {
    const months = n.months.map((m) => `${m.paymentMonth}月 ${yen(m.remuneration)}（${m.basisDays}日）`).join('<br>');
    return `
      <tr data-id="${n.employeeId}">
        <td class="branch-select-col">
          <input type="checkbox" data-action="select-geppen" data-id="${n.employeeId}"
            ${geppenSelected.has(n.employeeId) ? 'checked' : ''}>
        </td>
        <td>${escapeHtml(n.employeeName)}</td>
        <td>${escapeHtml(n.insuranceNumber) || '<span class="is-missing">未登録</span>'}</td>
        <td>${escapeHtml(formatBirthDateForForm(n.birthDate)) || '<span class="is-missing">未登録</span>'}</td>
        <td>${ymLabel(n.revisionYm)}</td>
        <td>${n.fixedWageDirection === 'up' ? '昇給' : '降給'}（${ymLabel(n.startYm)}）</td>
        <td class="num">${months}</td>
        <td class="num">${yen(n.averageRemuneration)}</td>
        <td>${formatThousands(n.currentHealthStandardMonthly)}円 → <strong>${formatThousands(n.newHealthStandardMonthly)}円</strong></td>
      </tr>
    `;
  }).join('');

  updateSheetSelect('geppenSheet', geppenSelected.size, GEPPEN_FORM.perSheet);
  const all = document.getElementById('geppenSelectAll');
  all.checked = geppenNotices.length > 0 && geppenSelected.size === geppenNotices.length;
  all.indeterminate = geppenSelected.size > 0 && geppenSelected.size < geppenNotices.length;
}

async function loadGeppen() {
  showExportStatus('geppenStatus', '対象者を集計しています…', false);
  try {
    geppenNotices = await listMonthlyRevisionNotices();
    geppenSelected.clear();
    geppenNotices.forEach((n) => geppenSelected.add(n.employeeId));
    renderGeppenTable();
    showExportStatus('geppenStatus', `対象者 ${geppenNotices.length} 名を集計しました。`, false);
  } catch (e) {
    showExportStatus('geppenStatus', '集計に失敗しました：' + e.message, true);
  }
}

async function exportGeppen() {
  const targets = selectedItems(geppenNotices, geppenSelected, (n) => n.employeeId);
  if (!targets.length) {
    showExportStatus('geppenStatus', '出力する従業員にチェックを入れてください。', true);
    return;
  }
  const sheet = Number(document.getElementById('geppenSheet').value) || 1;
  const page = targets.slice((sheet - 1) * GEPPEN_FORM.perSheet, sheet * GEPPEN_FORM.perSheet);
  const btn = document.getElementById('geppenExcelBtn');
  btn.disabled = true;
  showExportStatus('geppenStatus', 'Excelを作成しています…', false);
  try {
    const employee = await getEmployee(page[0].employeeId);
    const company = await getCompany(employee && employee.branchId);
    const values = buildGeppenFormValues(page, company);
    const { blob } = await fillXlsxTemplate(GEPPEN_FORM.templateUrl, values);
    downloadBlob(blob, `月額変更届_${sheet}枚目.xlsx`);
    showExportStatus('geppenStatus', `${page.length}名分（${sheet}枚目）の月額変更届をダウンロードしました。`, false);
  } catch (e) {
    showExportStatus('geppenStatus', 'Excelの作成に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// イベント
// ---------------------------------------------------------------------------
document.querySelector('#santeiTable tbody').addEventListener('change', (e) => {
  const box = e.target.closest('[data-action="select-santei"]');
  if (!box) return;
  if (box.checked) santeiSelected.add(box.dataset.id); else santeiSelected.delete(box.dataset.id);
  renderSanteiTable();
});
document.getElementById('santeiSelectAll').addEventListener('change', (e) => {
  santeiSelected.clear();
  if (e.target.checked) santeiEntries.forEach((entry) => santeiSelected.add(entry.employeeId));
  renderSanteiTable();
});
document.getElementById('santeiYear').addEventListener('change', loadSantei);
document.getElementById('santeiExcelBtn').addEventListener('click', exportSantei);

document.querySelector('#geppenTable tbody').addEventListener('change', (e) => {
  const box = e.target.closest('[data-action="select-geppen"]');
  if (!box) return;
  if (box.checked) geppenSelected.add(box.dataset.id); else geppenSelected.delete(box.dataset.id);
  renderGeppenTable();
});
document.getElementById('geppenSelectAll').addEventListener('change', (e) => {
  geppenSelected.clear();
  if (e.target.checked) geppenNotices.forEach((n) => geppenSelected.add(n.employeeId));
  renderGeppenTable();
});
document.getElementById('geppenExcelBtn').addEventListener('click', exportGeppen);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('insurance-report.html');
  renderNavbarUser(user);

  // 対象年の選択肢（当年を含む直近5年）
  const thisYear = new Date().getFullYear();
  const yearSelect = document.getElementById('santeiYear');
  for (let y = thisYear; y >= thisYear - 4; y--) {
    const option = document.createElement('option');
    option.value = String(y);
    option.textContent = `${y}年（令和${toReiwaYear(y)}年）`;
    yearSelect.appendChild(option);
  }

  await loadSantei();
  await loadGeppen();
})();
