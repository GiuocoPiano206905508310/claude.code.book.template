// ============================================================================
// ダッシュボード画面のロジック
// ============================================================================

renderNavbar('index.html');

const employees = listEmployees();
const ym = currentYm();
document.getElementById('thisMonthLabel').textContent = ymLabel(ym);

if (employees.length === 0) {
  document.getElementById('emptyState').style.display = '';
  document.getElementById('summaryGrid').innerHTML = '';
} else {
  document.getElementById('employeeStatusSection').style.display = '';

  let createdCount = 0;
  let grossTotal = 0;
  let netTotal = 0;
  let totalOvertimeHours = 0;
  let totalAbsenceDays = 0;

  const tbody = document.querySelector('#statusTable tbody');
  tbody.innerHTML = '';

  for (const emp of employees) {
    const slip = getPayslip(emp.id, ym);
    const summary = computeMonthSummary(emp, ym);
    totalOvertimeHours += summary.overtimeHours;
    totalAbsenceDays += summary.absenceDays;
    if (slip) {
      createdCount++;
      grossTotal += slip.result.grossPay;
      netTotal += slip.result.netPay;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(emp.name)}</td>
      <td>${escapeHtml(emp.employmentType)}</td>
      <td>${slip ? `<span class="badge badge-work">作成済み（手取り ${formatThousands(slip.result.netPay)} 円）</span>` : '<span class="badge">未作成</span>'}</td>
      <td class="actions">
        <a class="btn btn-sm btn-outline" href="payroll.html?emp=${encodeURIComponent(emp.id)}&ym=${encodeURIComponent(ym)}">給与計算へ</a>
        <a class="btn btn-sm btn-outline" href="attendance.html?emp=${encodeURIComponent(emp.id)}&ym=${encodeURIComponent(ym)}">勤怠へ</a>
      </td>
    `;
    tbody.appendChild(tr);
  }

  const tiles = [
    ['登録従業員数', `${employees.length} 名`, ''],
    ['今月の給与明細作成状況', `${createdCount} / ${employees.length} 名`, createdCount === employees.length ? '' : 'warn'],
    ['今月の総支給額合計（作成済み分）', `${formatThousands(grossTotal)} 円`, ''],
    ['今月の手取り合計（作成済み分）', `${formatThousands(netTotal)} 円`, 'accent'],
    ['全従業員の残業時間合計', `${totalOvertimeHours.toFixed(1)} h`, ''],
    ['全従業員の欠勤日数合計', `${totalAbsenceDays} 日`, totalAbsenceDays ? 'warn' : ''],
  ];
  document.getElementById('summaryGrid').innerHTML = tiles.map(([label, value, cls]) => `
    <div class="summary-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value ${cls}">${value}</div>
    </div>
  `).join('');
}
