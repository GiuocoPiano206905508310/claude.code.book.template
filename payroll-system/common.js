// ============================================================================
// 共通UIヘルパー（ナビゲーション描画・数値入力フォーマット・雑多なユーティリティ）
// ============================================================================

const NAV_ITEMS = [
  { href: 'index.html', label: 'ダッシュボード' },
  { href: 'company.html', label: '会社' },
  { href: 'employees.html', label: '従業員' },
  { href: 'attendance.html', label: '勤怠' },
  { href: 'payroll.html', label: '給与計算' },
  { href: 'bonus.html', label: '賞与計算' },
  { href: 'leave.html', label: '有給休暇管理簿' },
];

// 表示用の性別ラベル（「その他」選択時は自由入力欄の値、未入力なら「その他」）
function employeeGenderLabel(emp) {
  if (emp.gender === 'その他') return emp.genderOther || 'その他';
  return emp.gender || '';
}

function renderNavbar(activeHref) {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const links = NAV_ITEMS.map((item) => {
    const cls = item.href === activeHref ? 'nav-link active' : 'nav-link';
    return `<a class="${cls}" href="${item.href}">${item.label}</a>`;
  }).join('');
  nav.innerHTML = `
    <a class="brand" href="index.html">給与・勤怠管理システム</a>
    <div class="nav-links">${links}<span id="navUserArea"></span></div>
  `;
}

// ログイン中のユーザー名（アカウント設定画面へのリンク）とログアウトボタンを
// ナビバーに反映する。各ページで requireAuth() の後に呼び出す。
// accountHref: アカウント設定画面へのパス（省略時は 'account.html'。timeclockなど
// 別ディレクトリのページからは '../payroll-system/account.html' 等を指定する）
function renderNavbarUser(user, accountHref) {
  const area = document.getElementById('navUserArea');
  if (!area || !user) return;
  area.innerHTML = `
    <a class="nav-link" href="${accountHref || 'account.html'}">${escapeHtml(currentUsername(user))} さん</a>
    <a class="nav-link" href="#" id="logoutLink">ログアウト</a>
  `;
  document.getElementById('logoutLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
    location.href = 'login.html';
  });
}

// ---------- 画面の表示設定（白/黒/端末の設定に合わせる） ----------
const THEME_STORAGE_KEY = 'themePreference';

// 保存済みの設定を返す（'light' | 'dark' | 'system'）
function getThemePreference() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return (v === 'light' || v === 'dark') ? v : 'system';
  } catch (e) {
    return 'system';
  }
}

// data-theme属性を切り替えて即座に画面に反映する（style.cssの
// :root[data-theme="..."] ルールで参照）
function applyThemePreference(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setThemePreference(theme) {
  try {
    if (theme === 'light' || theme === 'dark') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch (e) { /* localStorage不可の環境では即時反映のみ行う */ }
  applyThemePreference(theme);
}

// 数字にカンマを付けて表示する入力欄
function attachThousandsFormatting(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', () => {
    const cursorPos = input.selectionStart;
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/[^\d]/g, '').length;
    const raw = input.value.replace(/[^\d]/g, '');
    input.value = raw === '' ? '' : Number(raw).toLocaleString('en-US');
    let count = 0, pos = input.value.length;
    for (let i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i])) count++;
      if (count === digitsBeforeCursor) { pos = i + 1; break; }
    }
    input.setSelectionRange(pos, pos);
  });
}

function getNumInputValue(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = String(el.value).replace(/,/g, '');
  return Number(raw) || 0;
}

// 金額表示用。フォーム初期値の整数はそのまま、計算結果の端数（保険料等の四捨五入誤差）は丸めて表示する
function formatThousands(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

// ひらがな→カタカナ変換（IME変換中の読みからフリガナを自動生成する用途）
function hiraganaToKatakana(str) {
  return String(str || '').replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function currentYmInputValue() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function ymLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

function fmtHistoryDateTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} `
    + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// listChangeHistory()の戻り値を「変更履歴」セクションのHTMLに変換する共通ヘルパー
function renderChangeHistoryList(history) {
  if (!history.length) return '';
  return history.map((h) => `
    <div class="history-entry">
      <div class="history-entry-date">${escapeHtml(fmtHistoryDateTime(h.changedAt))}</div>
      <ul class="history-entry-changes">
        ${h.changes.map((c) => `<li><strong>${escapeHtml(c.label)}</strong>：${escapeHtml(c.before) || '(未設定)'} → ${escapeHtml(c.after) || '(未設定)'}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

function previousYm(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

const AGE_GROUP_LABELS = {
  under40: '40歳未満',
  '40to64': '40〜64歳',
  '65to69': '65〜69歳',
  '70to74': '70〜74歳',
  '75plus': '75歳以上',
};

// 従業員マスタ・会社マスタから取り込んだ値や集計値を、項目名(左)・値(右)の
// 罫線付きリスト形式で表示する（payroll.js / bonus.js / leave.js / attendance.js から共用）
// tiles の各要素は [label, value] または強調表示用に [label, value, cls]（'accent' | 'warn'）
function renderInfoTiles(containerId, tiles) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="info-list">${tiles.map(([label, value, cls]) => `
    <div class="info-row">
      <div class="info-label">${label}</div>
      <div class="info-value ${cls || ''}">${value}</div>
    </div>
  `).join('')}</div>`;
}

// 都道府県セレクトの生成（employees.js / payroll.js から共用）
function populatePrefectureSelect(selectId, selected) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  for (const name of Object.keys(PREFECTURE_HEALTH_RATES)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (selected ? name === selected : name === '東京') option.selected = true;
    select.appendChild(option);
  }
}

function populateIndustrySelect(selectId, selected) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  for (const name of Object.keys(EMPLOYMENT_RATES_BY_INDUSTRY)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (selected ? name === selected : name === '一般の事業') option.selected = true;
    select.appendChild(option);
  }
}

// 賃金締日・賃金支払日など「月の日付（1〜31日、または末日）」を選ぶ選択肢を生成する
function populateDayOfMonthSelect(selectId, selected) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  const endOption = document.createElement('option');
  endOption.value = 'end';
  endOption.textContent = '末日';
  select.appendChild(endOption);
  for (let d = 1; d <= 31; d++) {
    const option = document.createElement('option');
    option.value = String(d);
    option.textContent = `${d}日`;
    select.appendChild(option);
  }
  select.value = selected || 'end';
}

// ---------------------------------------------------------------------------
// 明細の印刷・Excel出力・コピー（給与計算画面・賞与計算画面で共用）
// ---------------------------------------------------------------------------

// 印刷対象の内容を専用の印刷用エリアに複製し、他の要素を印刷から完全に除外する
// （visibility:hiddenだけでは要素が高さを占有したままになり、余分な白紙ページが出るため）。
// orientationに'landscape'を指定すると、賃金台帳のような横に長い表を印刷する際に
// 用紙を横向きにする（印刷後は@pageの上書きを取り除き、他の印刷を portrait のまま保つ）
function printSection(targetId, orientation) {
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = document.getElementById(targetId).innerHTML;
  printArea.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

  let orientationStyle = null;
  if (orientation === 'landscape') {
    orientationStyle = document.createElement('style');
    orientationStyle.textContent = '@page { size: landscape; margin: 10mm; }';
    document.head.appendChild(orientationStyle);
  }
  window.print();
  if (orientationStyle) {
    window.addEventListener('afterprint', () => orientationStyle.remove(), { once: true });
  }
}

function showExportStatus(statusId, message, isError) {
  const el = document.getElementById(statusId);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', !!isError);
}

// Excelで開けるHTMLテーブル形式の.xlsを生成、格子状の罫線付き
function exportTableToExcel(tableId, filename, extraRow, statusId) {
  const cellStyle = 'border:1px solid #000;padding:5px 10px;';
  const headStyle = cellStyle + 'background:#eee;font-weight:bold;';
  let rows = '';
  document.getElementById(tableId).querySelectorAll('tbody tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => `<td style="${cellStyle}">${td.textContent.trim()}</td>`).join('');
    rows += `<tr>${cells}</tr>`;
  });
  if (extraRow) {
    rows += `<tr><td style="${cellStyle}font-weight:bold;">${extraRow[0]}</td><td style="${cellStyle}font-weight:bold;">${extraRow[1]}</td></tr>`;
  }
  const html = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;"><thead><tr><th style="${headStyle}">項目</th><th style="${headStyle}">金額</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showExportStatus(statusId, '保存しました。');
}

// 結果をタブ区切りテキストとしてクリップボードにコピー
async function copyResultToClipboard(tableId, extraRow, statusId) {
  let text = '';
  document.getElementById(tableId).querySelectorAll('tbody tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
    text += cells.join('\t') + '\n';
  });
  if (extraRow) {
    text += extraRow.join('\t') + '\n';
  }
  try {
    await navigator.clipboard.writeText(text);
    showExportStatus(statusId, 'コピーしました。Excelなどに貼り付けてください。', false);
  } catch (e) {
    showExportStatus(statusId, 'コピーに失敗しました：' + (e && e.message ? e.message : e), true);
  }
}

// Excelで開けるHTMLテーブル形式の.xlsを生成、格子状の罫線付き（見出し行の列数・内容は
// 対象テーブルのtheadからそのまま読み取るため、2列の明細に限らず任意の列数で使える）
function exportFullTableToExcel(tableId, filename, statusId) {
  const cellStyle = 'border:1px solid #000;padding:5px 10px;';
  const headStyle = cellStyle + 'background:#eee;font-weight:bold;';
  const table = document.getElementById(tableId);
  const headCells = Array.from(table.querySelectorAll('thead th'))
    .map((th) => `<th style="${headStyle}">${th.textContent.trim()}</th>`).join('');
  let rows = '';
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => `<td style="${cellStyle}">${td.textContent.trim()}</td>`).join('');
    rows += `<tr>${cells}</tr>`;
  });
  const html = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;"><thead><tr>${headCells}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showExportStatus(statusId, '保存しました。');
}

// 見出し行を含め、タブ区切りテキストとしてクリップボードにコピー（任意の列数で使える）
async function copyFullTableToClipboard(tableId, statusId) {
  const table = document.getElementById(tableId);
  let text = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim()).join('\t') + '\n';
  table.querySelectorAll('tbody tr').forEach((tr) => {
    text += Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()).join('\t') + '\n';
  });
  try {
    await navigator.clipboard.writeText(text);
    showExportStatus(statusId, 'コピーしました。Excelなどに貼り付けてください。', false);
  } catch (e) {
    showExportStatus(statusId, 'コピーに失敗しました：' + (e && e.message ? e.message : e), true);
  }
}

// ページ最上部・最下部へ移動するボタンを画面右下に固定表示する（全ページ共通）
function renderScrollButtons() {
  if (document.getElementById('scrollButtons')) return;
  const container = document.createElement('div');
  container.id = 'scrollButtons';
  container.className = 'scroll-buttons';
  container.innerHTML = `
    <button type="button" id="scrollTopBtn" class="scroll-btn" title="ページ最上部へ" aria-label="ページ最上部へ">▲</button>
    <button type="button" id="scrollBottomBtn" class="scroll-btn" title="ページ最下部へ" aria-label="ページ最下部へ">▼</button>
  `;
  document.body.appendChild(container);
  document.getElementById('scrollTopBtn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('scrollBottomBtn').addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
}

renderScrollButtons();
