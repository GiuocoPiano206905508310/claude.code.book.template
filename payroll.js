// ============================================================================
// 給与計算画面のロジック
// ============================================================================

let currentAttendanceSummary = null;
let currentAutoOvertimePay = 0;
// 従業員マスタ管理（保存済み明細を表示中の場合はその当時の値）から取り込む、
// 給与計算画面では編集不可の項目
let currentEmployeeFields = null;
// 会社マスタ管理（保存済み明細を表示中の場合はその当時の値）から取り込む、
// 給与計算画面では編集不可の項目
let currentCompanyFields = null;
// 固定残業代（みなし残業代）。保存済み明細を表示中の場合はその当時の値、
// 新規計算の場合は従業員マスタの設定と当月の勤怠集計から算出する
let currentFixedOvertime = null;

async function currentEmployee() {
  const id = document.getElementById('employeeSelect').value;
  return id ? await getEmployee(id) : null;
}

async function populateEmployeeSelect() {
  const employees = await listEmployees();
  const select = document.getElementById('employeeSelect');
  select.innerHTML = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  const hasEmployees = employees.length > 0;
  document.getElementById('noEmployeeState').style.display = hasEmployees ? 'none' : '';
  document.getElementById('payrollContent').style.display = hasEmployees ? '' : 'none';
  return hasEmployees;
}

function renderEmployeeInfoGrid(fields) {
  renderInfoTiles('employeeInfoGrid', [
    ['雇用形態', fields.employmentType],
    ['年齢区分', AGE_GROUP_LABELS[fields.ageGroup] || fields.ageGroup],
    [fields.employmentType === '役員' ? '役員報酬' : '基本給', `${formatThousands(fields.baseSalary)} 円`],
    ['その他手当（課税）', `${formatThousands(fields.taxableAllowance)} 円`],
    ['通勤手当（非課税）', `${formatThousands(fields.commuteAllowance)} 円`],
    ['扶養親族等の数', `${fields.dependents} 人`],
    ['甲欄・乙欄', fields.taxTable === '甲' ? '甲欄' : '乙欄'],
  ]);
}

function renderFixedOvertimeCard(fo) {
  document.getElementById('fixedOvertimeCard').style.display = fo.enabled ? '' : 'none';
  if (!fo.enabled) return;
  document.getElementById('fixedOvertimeCardTitle').textContent =
    fo.allowanceName ? `固定残業代（${fo.allowanceName}）` : '固定残業代（みなし残業代）';
  document.getElementById('fixedOvertimeNameDisplay').textContent = fo.allowanceName || '—';
  document.getElementById('fixedOvertimeHoursDisplay').textContent = `${fo.monthlyHours} 時間`;
  document.getElementById('fixedOvertimeAmountDisplay').textContent = `${formatThousands(fo.fixedPay)} 円`;
  document.getElementById('excessOvertimePayDisplay').textContent = `${formatThousands(fo.excessPay)} 円`;
  document.getElementById('excessOvertimeNote').textContent = fo.excessPay > 0
    ? '当月の実際の残業時間が固定残業時間数を超えたため、超過分を従業員マスタの割増率で計算し追加しています。'
    : '当月の実際の残業時間は固定残業時間数の範囲内のため、超過分はありません。';
}

function renderCompanyInfoGrid(fields) {
  renderInfoTiles('companyInfoGrid', [
    ['源泉所得税の計算方法', fields.calcMethod === 'machine' ? '機械計算（甲欄のみ）' : '月額表'],
    ['健康保険の種類', fields.healthInsuranceType === 'kumiai' ? '健康保険組合' : '協会けんぽ'],
    ['都道府県（協会けんぽ支部）', fields.prefecture],
    ['健康保険料率', `${(fields.healthRate * 100).toFixed(2)} %`],
    ['介護保険料率', `${(fields.careRate * 100).toFixed(2)} %`],
    ['厚生年金保険料率', `${(fields.pensionRate * 100).toFixed(2)} %`],
    ['事業の種類（雇用保険）', fields.industryType],
    ['雇用保険料率（従業員負担分）', `${(fields.employmentRate * 100).toFixed(2)} %`],
  ]);
}

// 従業員マスタ・勤怠集計をもとに、フォームへ初期値を流し込む
async function loadFormForEmployeeMonth() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;

  const company = await getCompany();
  currentAttendanceSummary = await computeMonthSummary(employee, ym, company);
  const commuteAllowanceForOvertimeBase = employee.commuteAllowanceExcludeFromOvertimeBase === false ? (employee.commuteAllowance || 0) : 0;
  const overtimeBaseWage = employee.baseSalary + sumNonExcludedAllowances(employee.allowances) + commuteAllowanceForOvertimeBase;
  currentAutoOvertimePay = calcOvertimePayFromHours(
    overtimeBaseWage, employee.monthlyStandardHours, currentAttendanceSummary.overtimeHours, employee.overtimeWithin60Rate
  );
  const absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
  const employeeAgeGroup = ageGroupFromAge(calcAge(employee.birthDate));

  const saved = await getPayslip(employee.id, ym);
  const input = saved ? saved.input : null;

  currentEmployeeFields = {
    employmentType: input ? input.employmentType : employee.employmentType,
    ageGroup: input ? input.ageGroup : employeeAgeGroup,
    baseSalary: input ? input.baseSalary : employee.baseSalary,
    taxableAllowance: input ? input.taxableAllowance : sumAllowances(employee.allowances),
    commuteAllowance: input ? input.commuteAllowance : employee.commuteAllowance,
    dependents: input ? input.dependents : employee.dependents,
    taxTable: input ? input.taxTable : employee.taxTable,
    residentTax: input ? input.residentTax : employee.residentTax,
  };
  renderEmployeeInfoGrid(currentEmployeeFields);
  document.getElementById('residentTaxDisplay').textContent = `${formatThousands(currentEmployeeFields.residentTax)} 円`;

  currentCompanyFields = {
    calcMethod: input ? input.calcMethod : company.calcMethod,
    healthRate: input ? input.healthRate : Number(company.healthRate) / 100,
    careRate: input ? input.careRate : Number(company.careRate) / 100,
    pensionRate: input ? input.pensionRate : Number(company.pensionRate) / 100,
    employmentRate: input ? input.employmentRate : Number(company.employmentRate) / 100,
    healthInsuranceType: company.healthInsuranceType,
    prefecture: company.prefecture,
    industryType: company.industryType,
  };
  renderCompanyInfoGrid(currentCompanyFields);

  if (input && input.fixedOvertimeEnabled !== undefined) {
    currentFixedOvertime = {
      enabled: !!input.fixedOvertimeEnabled,
      allowanceName: input.fixedOvertimeAllowanceName || '',
      monthlyHours: input.fixedOvertimeMonthlyHours || 0,
      fixedPay: input.fixedOvertimePay || 0,
      excessPay: input.excessOvertimePay || 0,
    };
  } else if (employee.fixedOvertimeEnabled) {
    const hourlyWage = calcHourlyWage(overtimeBaseWage, employee.monthlyStandardHours);
    const excess = calcFixedOvertimeExcess(
      hourlyWage, employee.fixedOvertimeMonthlyHours, employee.fixedOvertimeBaseCategories,
      currentAttendanceSummary.overtimeCategoryMonthTotals, employee
    );
    currentFixedOvertime = {
      enabled: true,
      allowanceName: employee.fixedOvertimeAllowanceName,
      monthlyHours: employee.fixedOvertimeMonthlyHours,
      fixedPay: employee.fixedOvertimeAmount,
      excessPay: excess.excessPay,
    };
  } else {
    currentFixedOvertime = { enabled: false, allowanceName: '', monthlyHours: 0, fixedPay: 0, excessPay: 0 };
  }
  renderFixedOvertimeCard(currentFixedOvertime);

  const overtimePayInput = document.getElementById('overtimePay');
  overtimePayInput.disabled = currentFixedOvertime.enabled;
  if (currentFixedOvertime.enabled) {
    overtimePayInput.value = formatThousands(input ? input.overtimePay : 0);
    document.getElementById('overtimeNote').textContent =
      '固定残業代が設定されているため、通常の残業手当は自動計算されません（残業代は下部の固定残業代・超過残業代でまとめて計算されます）。';
  } else {
    overtimePayInput.value = formatThousands(input ? input.overtimePay : currentAutoOvertimePay);
    document.getElementById('overtimeNote').textContent =
      `勤怠集計：残業 ${currentAttendanceSummary.overtimeHours.toFixed(1)}h ×「法定外労働時間(月60時間以内)」の割増率(${Number(employee.overtimeWithin60Rate).toFixed(2)}倍) → 自動計算額 ${formatThousands(currentAutoOvertimePay)} 円（編集可。深夜・休日等の割増区分は従業員マスタで設定・手動反映してください）`;
  }
  document.getElementById('applyAbsenceDeduction').checked = input ? !!input.applyAbsenceDeduction : currentAttendanceSummary.absenceDays > 0;

  document.getElementById('absenceDeductionPreview').textContent = `${formatThousands(absenceDeduction)} 円 / 欠勤 ${currentAttendanceSummary.absenceDays} 日`;

  renderAttendanceSummaryTiles(currentAttendanceSummary);

  if (saved) {
    renderResult(saved.result);
  } else {
    document.querySelector('#resultTable tbody').innerHTML = '';
    document.getElementById('netValue').textContent = '— 円';
  }
}

function renderAttendanceSummaryTiles(s) {
  const tiles = [
    ['実働時間', `${s.workedHours.toFixed(1)} h`, ''],
    ['残業時間', `${s.overtimeHours.toFixed(1)} h`, 'accent'],
    ['欠勤日数', `${s.absenceDays} 日`, s.absenceDays ? 'warn' : ''],
    ['有給休暇日数', `${s.paidLeaveDays} 日`, ''],
  ];
  document.getElementById('attendanceSummaryGrid').innerHTML = tiles.map(([label, value, cls]) => `
    <div class="summary-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value ${cls}">${value}</div>
    </div>
  `).join('');
}

function collectInput() {
  return {
    ...currentEmployeeFields,
    ...currentCompanyFields,
    overtimePay: getNumInputValue('overtimePay'),
    applyAbsenceDeduction: document.getElementById('applyAbsenceDeduction').checked,
    fixedOvertimeEnabled: currentFixedOvertime.enabled,
    fixedOvertimeAllowanceName: currentFixedOvertime.allowanceName,
    fixedOvertimeMonthlyHours: currentFixedOvertime.monthlyHours,
    fixedOvertimePay: currentFixedOvertime.fixedPay,
    excessOvertimePay: currentFixedOvertime.excessPay,
  };
}

async function calculate() {
  const input = collectInput();
  const result = calculateMonthlyPayroll(input);

  const employee = await currentEmployee();
  result.absenceDeduction = 0;
  if (input.applyAbsenceDeduction && employee && currentAttendanceSummary) {
    result.absenceDeduction = calcAbsenceDeduction(employee.baseSalary, employee.monthlyStandardDays, currentAttendanceSummary.absenceDays);
    result.netPay -= result.absenceDeduction;
  }

  renderResult(result);
  return { input, result };
}

function renderResult(r) {
  const rows = [
    ['総支給額', r.grossPay, 'plain', true],
    ['健康保険料', -r.healthInsurance, 'deduction', r.hasHealth],
    ['子ども・子育て支援金', -r.childSupportLevy, 'deduction', r.hasHealth],
    ['介護保険料', -r.careInsurance, 'deduction', r.hasCare],
    ['厚生年金保険料', -r.pensionInsurance, 'deduction', r.hasPension],
    ['雇用保険料', -r.employmentInsurance, 'deduction', r.subjectEmploymentInsurance],
    ['社会保険料合計', -r.socialInsuranceTotal, 'total', true],
    ['源泉所得税（概算）', -r.monthlyIncomeTax, 'deduction', !r.isTaxExempt],
    ['住民税', -r.residentTax, 'deduction', true],
  ];
  if (r.absenceDeduction) {
    rows.push(['欠勤控除', -r.absenceDeduction, 'deduction', true]);
  }

  const tbody = document.querySelector('#resultTable tbody');
  tbody.innerHTML = '';
  for (const [label, value, kind, applicable] of rows) {
    const tr = document.createElement('tr');
    if (kind === 'total') tr.className = 'total';
    const valueClass = !applicable ? 'value na' : (kind === 'deduction' ? 'value deduction' : 'value');
    const valueHtml = applicable ? yen(value) : '対象外';
    tr.innerHTML = `<td class="label">${label}</td><td class="${valueClass}">${valueHtml}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('netValue').textContent = yen(r.netPay);
}

async function renderHistoryTable() {
  const employee = await currentEmployee();
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '';
  if (!employee) { document.getElementById('historyEmptyState').style.display = ''; return; }

  const slips = await listPayslips(employee.id);
  const yms = Object.keys(slips).sort().reverse();
  document.getElementById('historyEmptyState').style.display = yms.length ? 'none' : '';
  document.getElementById('historyTable').style.display = yms.length ? '' : 'none';

  for (const ym of yms) {
    const slip = slips[ym];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ymLabel(ym)}</td>
      <td class="num">${formatThousands(slip.result.grossPay)} 円</td>
      <td class="num">${formatThousands(slip.result.netPay)} 円</td>
      <td class="actions">
        <button type="button" class="btn btn-sm btn-outline" data-action="view" data-ym="${ym}">表示</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-ym="${ym}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.getElementById('monthInput').value = btn.dataset.ym;
      await refreshAll();
    });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`${ymLabel(btn.dataset.ym)}分の給与明細を削除します。よろしいですか？`)) return;
      await deletePayslip(employee.id, btn.dataset.ym);
      await renderHistoryTable();
    });
  });
}

async function refreshAll() {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  await loadFormForEmployeeMonth();
  await renderHistoryTable();
  document.getElementById('goAttendanceBtn').href = employee && ym
    ? `attendance.html?emp=${encodeURIComponent(employee.id)}&ym=${encodeURIComponent(ym)}`
    : 'attendance.html';
}

document.getElementById('employeeSelect').addEventListener('change', refreshAll);
document.getElementById('monthInput').addEventListener('change', refreshAll);
document.getElementById('calcBtn').addEventListener('click', calculate);

document.getElementById('saveBtn').addEventListener('click', async () => {
  const employee = await currentEmployee();
  const ym = document.getElementById('monthInput').value;
  if (!employee || !ym) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    const { input, result } = await calculate();
    await savePayslip(employee.id, ym, { input, result });
    showExportStatus('exportStatus', `${ymLabel(ym)}分の給与明細を保存しました。`, false);
    await renderHistoryTable();
  } catch (e) {
    showExportStatus('exportStatus', '保存に失敗しました：' + e.message, true);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('exportPdfBtn').addEventListener('click', () => printSection('resultCard'));
document.getElementById('exportExcelBtn').addEventListener('click', () => exportTableToExcel(
  'resultTable', '給与計算結果.xls',
  ['差引支給額（手取り）', document.getElementById('netValue').textContent.trim()],
  'exportStatus'
));
document.getElementById('exportCopyBtn').addEventListener('click', () => copyResultToClipboard(
  'resultTable',
  ['差引支給額（手取り）', document.getElementById('netValue').textContent.trim()],
  'exportStatus'
));

['overtimePay'].forEach(attachThousandsFormatting);

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('payroll.html');
  renderNavbarUser(user);

  document.getElementById('monthInput').value = currentYmInputValue();
  const hasEmployees = await populateEmployeeSelect();

  const params = new URLSearchParams(location.search);
  if (hasEmployees) {
    if (params.get('emp') && await getEmployee(params.get('emp'))) {
      document.getElementById('employeeSelect').value = params.get('emp');
    }
    if (params.get('ym')) {
      document.getElementById('monthInput').value = params.get('ym');
    }
  }

  await refreshAll();
})();
