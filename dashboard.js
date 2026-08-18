// ============================================================================
// ダッシュボード画面のロジック
// ============================================================================

// ---------------------------------------------------------------------------
// お知らせ（社会保険の月額変更届＝随時改定の要件を満たした従業員の通知）
// ---------------------------------------------------------------------------
function renderMonthlyRevisionNotices(notices) {
  const list = document.getElementById('notificationList');
  const empty = document.getElementById('notificationEmptyState');
  const count = document.getElementById('notificationCount');

  count.textContent = notices.length ? `（${notices.length}件）` : '';
  empty.style.display = notices.length ? 'none' : '';
  list.innerHTML = notices.map((n) => {
    const direction = n.fixedWageDirection === 'up' ? '昇給' : '降給';
    const gradeText = `${n.currentHealthGrade}等級（${formatThousands(n.currentHealthStandardMonthly)}円）`
      + ` → ${n.newHealthGrade}等級（${formatThousands(n.newHealthStandardMonthly)}円）`;
    const monthRows = n.months.map((m) => `
      <tr>
        <td>${ymLabel(m.ym)}</td>
        <td class="num">${formatThousands(m.remuneration)} 円</td>
        <td class="num">${m.basisDays} 日</td>
      </tr>
    `).join('');
    const paymentNote = n.paymentMonthSetting === 'current' ? '当月払い' : '翌月払い';
    return `
      <div class="notification-item">
        <p class="notification-title">
          <span class="badge badge-leave">月額変更届</span>
          ${escapeHtml(n.employeeName)} さん：${ymLabel(n.changeYm)}分の給与の${direction}により随時改定の要件を満たしています
        </p>
        <p class="notification-body">
          起算月（変動後の報酬を初めて受けた月）：<strong>${ymLabel(n.startYm)}</strong>
          （${ymLabel(n.changeYm)}分の給与・${paymentNote}）<br>
          改定月（起算月から4か月目）：<strong>${ymLabel(n.revisionYm)}</strong><br>
          健康保険の標準報酬月額：${gradeText}（${Math.abs(n.gradeDiff)}等級の差）<br>
          厚生年金の標準報酬月額：${formatThousands(n.currentPensionStandardMonthly)}円 → ${formatThousands(n.newPensionStandardMonthly)}円<br>
          固定的賃金：${formatThousands(n.fixedWageBefore)}円 → ${formatThousands(n.fixedWageAfter)}円／3か月平均の報酬月額：${formatThousands(n.averageRemuneration)}円
        </p>
        <div class="data-table-wrap">
          <table class="data-table notification-table">
            <thead><tr><th>対象月（給与計算）</th><th class="num">報酬月額</th><th class="num">支払基礎日数</th></tr></thead>
            <tbody>${monthRows}</tbody>
          </table>
        </div>
        <p class="notification-body">
          <a href="employees.html">従業員マスタ管理</a>で標準報酬月額を改定後の金額に更新してください。
        </p>
      </div>
    `;
  }).join('');
}

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('index.html');
  renderNavbarUser(user);

  // お知らせは件数が多いと時間がかかるため、他の表示を妨げないよう並行して描画する
  listMonthlyRevisionNotices()
    .then(renderMonthlyRevisionNotices)
    .catch(() => renderMonthlyRevisionNotices([]));

  const employees = await listEmployees();
  const ym = currentYm();
  document.getElementById('thisMonthLabel').textContent = ymLabel(ym);

  if (employees.length === 0) {
    document.getElementById('emptyState').style.display = '';
    document.getElementById('summaryGrid').innerHTML = '';
    return;
  }

  document.getElementById('employeeStatusSection').style.display = '';

  let createdCount = 0;
  let grossTotal = 0;
  let netTotal = 0;
  let totalOvertimeHours = 0;
  let totalAbsenceDays = 0;

  const tbody = document.querySelector('#statusTable tbody');
  tbody.innerHTML = '';

  for (const emp of employees) {
    const slip = await getPayslip(emp.id, ym);
    const summary = await computeMonthSummary(emp, ym);
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
})();
