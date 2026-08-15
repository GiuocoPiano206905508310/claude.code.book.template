// ============================================================================
// データ層。Supabase（Postgres + RLS）に会社ごとのデータを保存する。
// 各テーブルは行レベルセキュリティ（RLS）で user_id = auth.uid() の行だけを
// 読み書きできるよう制限されているため、SELECT時に自分で絞り込む必要はない。
// 従業員マスタ / 勤怠記録 / 給与明細履歴 / 賞与明細履歴 / 会社設定を管理する。
// ============================================================================

async function getCurrentUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインしていません。');
  return user.id;
}

function genId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// 従業員マスタ
// ---------------------------------------------------------------------------
function employeeRowToObj(row) {
  const obj = {
    id: row.id,
    employeeNumber: row.employee_number || '',
    department: row.department || '',
    name: row.name,
    nameKana: row.name_kana || '',
    gender: row.gender || '男性',
    genderOther: row.gender_other || '',
    employeeCode: row.employee_code || '',
    loginPassword: row.login_password || '',
    employmentType: row.employment_type,
    hireDate: row.hire_date,
    birthDate: row.birth_date,
    baseSalary: row.base_salary,
    allowances: row.allowances || [],
    commuteAllowance: row.commute_allowance,
    commuteAllowanceExcludeFromOvertimeBase: row.commute_allowance_exclude,
    dependents: row.dependents,
    taxTable: row.tax_table,
    workStart: row.work_start,
    workEnd: row.work_end,
    standardDailyHours: Number(row.standard_daily_hours),
    weeklyScheduledDays: Number(row.weekly_scheduled_days) || 5,
    monthlyStandardHours: Number(row.monthly_standard_hours),
    monthlyStandardDays: Number(row.monthly_standard_days),
    branchId: row.branch_id || null,
  };
  const fixedOT = row.fixed_overtime || {};
  obj.fixedOvertimeEnabled = !!fixedOT.enabled;
  obj.fixedOvertimeAllowanceName = fixedOT.allowanceName || '';
  obj.fixedOvertimeMonthlyHours = Number(fixedOT.monthlyHours) || 0;
  obj.fixedOvertimeAmount = Number(fixedOT.amount) || 0;
  obj.fixedOvertimeBaseCategories = Array.isArray(fixedOT.baseCategories) && fixedOT.baseCategories.length
    ? fixedOT.baseCategories : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES.slice();
  const socialIns = row.social_insurance || {};
  const fixedOTAmountForStandard = obj.fixedOvertimeEnabled ? obj.fixedOvertimeAmount : 0;
  const standardMonthlyBase = computeStandardMonthlyBase(
    obj.baseSalary, fixedOTAmountForStandard, sumNonExcludedFromSocialInsurance(obj.allowances), obj.commuteAllowance
  );
  obj.healthInsuranceNumber = socialIns.healthInsuranceNumber || '';
  obj.healthStandardMonthly = Number(socialIns.healthStandardMonthly)
    || lookupStandardMonthlyAmount(standardMonthlyBase, HEALTH_STANDARD_BRACKETS);
  obj.pensionStandardMonthly = Number(socialIns.pensionStandardMonthly)
    || lookupStandardMonthlyAmount(standardMonthlyBase, PENSION_STANDARD_BRACKETS);
  return obj;
}

function employeeObjToRow(emp, userId) {
  return {
    user_id: userId,
    employee_number: emp.employeeNumber || null,
    department: emp.department || null,
    branch_id: emp.branchId || null,
    name: emp.name,
    name_kana: emp.nameKana || null,
    gender: emp.gender || null,
    gender_other: emp.genderOther || null,
    employee_code: emp.employeeCode || null,
    login_password: emp.loginPassword || null,
    employment_type: emp.employmentType,
    hire_date: emp.hireDate || null,
    birth_date: emp.birthDate || null,
    base_salary: emp.baseSalary,
    allowances: emp.allowances || [],
    commute_allowance: emp.commuteAllowance,
    commute_allowance_exclude: emp.commuteAllowanceExcludeFromOvertimeBase,
    dependents: emp.dependents,
    tax_table: emp.taxTable,
    work_start: emp.workStart,
    work_end: emp.workEnd,
    standard_daily_hours: emp.standardDailyHours,
    weekly_scheduled_days: emp.weeklyScheduledDays,
    monthly_standard_hours: emp.monthlyStandardHours,
    monthly_standard_days: emp.monthlyStandardDays,
    fixed_overtime: {
      enabled: !!emp.fixedOvertimeEnabled,
      allowanceName: emp.fixedOvertimeAllowanceName || '',
      monthlyHours: Number(emp.fixedOvertimeMonthlyHours) || 0,
      amount: Number(emp.fixedOvertimeAmount) || 0,
      baseCategories: (emp.fixedOvertimeBaseCategories && emp.fixedOvertimeBaseCategories.length)
        ? emp.fixedOvertimeBaseCategories : DEFAULT_FIXED_OVERTIME_BASE_CATEGORIES.slice(),
    },
    social_insurance: {
      healthInsuranceNumber: emp.healthInsuranceNumber || '',
      healthStandardMonthly: Number(emp.healthStandardMonthly) || 0,
      pensionStandardMonthly: Number(emp.pensionStandardMonthly) || 0,
    },
    updated_at: new Date().toISOString(),
  };
}

async function listEmployees() {
  const { data, error } = await supabaseClient.from('employees').select('*').order('name');
  if (error) throw error;
  return data.map(employeeRowToObj);
}

// 従業員が1人でも登録されているか（打刻ログイン前の画面表示用。
// パスワード等を含む全件データを読み込まずに済むよう件数のみ取得する）
async function hasAnyEmployees() {
  const { count, error } = await supabaseClient.from('employees').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count || 0) > 0;
}

async function getEmployee(id) {
  const { data, error } = await supabaseClient.from('employees').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? employeeRowToObj(data) : null;
}

// 勤怠打刻システムの従業員ログイン用。ユーザーIDで1件だけを取得する
// （全従業員のパスワードを一括で端末に読み込まないようにするため）
async function getEmployeeByCode(employeeCode) {
  const { data, error } = await supabaseClient.from('employees').select('*')
    .eq('employee_code', employeeCode).maybeSingle();
  if (error) throw error;
  return data ? employeeRowToObj(data) : null;
}

// ---------------------------------------------------------------------------
// 勤怠打刻専用（会社アカウントのログインなしで動作する）
//
// 打刻端末では会社アカウントでのログインを不要にしたいが、テーブルへの直接
// アクセスを未ログインユーザーに許可すると全社のデータが誰でも読めてしまう。
// そのためテーブルの権限は与えず、従業員本人の認証情報（氏名・ユーザーID・
// パスワード）が一致した場合のみ動作するデータベース側の関数（RPC）経由で
// 読み書きする。関数の定義は migration-timeclock-employee-auth.sql を参照。
// ---------------------------------------------------------------------------

// 認証に成功すると { employee_id, employee_name } を返す。失敗時はnull
async function timeclockEmployeeLogin(name, employeeCode, password) {
  const { data, error } = await supabaseClient.rpc('timeclock_employee_login', {
    p_name: name, p_code: employeeCode, p_password: password,
  });
  if (error) throw error;
  return (data && data[0]) || null;
}

// 指定日の打刻状況。記録がなければnull
async function timeclockGetDay(employeeCode, password, ym, day) {
  const { data, error } = await supabaseClient.rpc('timeclock_get_day', {
    p_code: employeeCode, p_password: password, p_ym: ym, p_day: Number(day),
  });
  if (error) throw error;
  const row = (data && data[0]) || null;
  if (!row) return null;
  return {
    clockIn: row.clock_in || '',
    clockOut: row.clock_out || '',
    breakMinutes: row.break_minutes,
    status: row.status,
  };
}

// kind: 'in'（出勤） / 'out'（退勤）、hm: 'HH:MM'
async function timeclockPunch(employeeCode, password, ym, day, kind, hm) {
  const { error } = await supabaseClient.rpc('timeclock_punch', {
    p_code: employeeCode, p_password: password, p_ym: ym,
    p_day: Number(day), p_kind: kind, p_time: hm,
  });
  if (error) throw error;
}

// emp.id が未設定なら新規追加、設定済みなら更新。更新時は変更履歴を記録する
async function saveEmployee(emp) {
  const userId = await getCurrentUserId();
  const row = employeeObjToRow(emp, userId);
  if (emp.id) {
    const { data: oldData, error: oldError } = await supabaseClient.from('employees').select('*').eq('id', emp.id).maybeSingle();
    if (oldError) throw oldError;
    const { data, error } = await supabaseClient.from('employees').update(row).eq('id', emp.id).select().single();
    if (error) throw error;
    const updated = employeeRowToObj(data);
    if (oldData) {
      const branches = await listBranches();
      const branchNameById = {};
      branches.forEach((b) => { branchNameById[b.id] = b.branchName; });
      const changes = diffFields(employeeRowToObj(oldData), updated, buildEmployeeHistoryFields(branchNameById));
      await recordChangeHistory('employee', emp.id, updated.name, changes);
    }
    return updated;
  }
  const { data, error } = await supabaseClient.from('employees').insert(row).select().single();
  if (error) throw error;
  return employeeRowToObj(data);
}

// 従業員を削除すると、紐づく勤怠・給与明細・賞与明細もDBの外部キー制約により自動削除される
async function deleteEmployee(id) {
  const { error } = await supabaseClient.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 勤怠記録
// ym: 'YYYY-MM' 形式、day: 1〜31（数値 or 文字列どちらでも可）
// record: { clockIn: 'HH:MM', clockOut: 'HH:MM', breakMinutes: number, status }
// status: 'normal' | 'paid_leave' | 'absence' | 'holiday_work'
// ---------------------------------------------------------------------------
async function getMonthAttendance(employeeId, ym) {
  const { data, error } = await supabaseClient
    .from('attendance_records').select('*').eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
  const result = {};
  for (const row of data) {
    result[String(row.day)] = {
      clockIn: row.clock_in || '',
      clockOut: row.clock_out || '',
      scheduledStart: row.scheduled_start || '',
      scheduledEnd: row.scheduled_end || '',
      breakMinutes: row.break_minutes,
      status: row.status,
      earlyOvertime: !!row.early_overtime,
    };
  }
  return result;
}

// attendance_records.early_overtime（早出残業チェック）列がまだ無いDBでも動くよう、
// 列が無いと分かった時点で以後は送信しない（勤怠の保存自体が失敗しないようにする）。
// 列を追加するSQLはmigration-attendance-early-overtime.sqlを参照。
let attendanceEarlyOvertimeColumnSupported = true;
function isMissingEarlyOvertimeColumnError(error) {
  const text = `${(error && error.message) || ''} ${(error && error.details) || ''}`;
  return text.includes('early_overtime');
}

async function setDayAttendance(employeeId, ym, day, record) {
  if (record === null) {
    const { error } = await supabaseClient.from('attendance_records').delete()
      .eq('employee_id', employeeId).eq('ym', ym).eq('day', day);
    if (error) throw error;
    return;
  }
  const userId = await getCurrentUserId();
  const row = {
    user_id: userId,
    employee_id: employeeId,
    ym,
    day: Number(day),
    clock_in: record.clockIn || null,
    clock_out: record.clockOut || null,
    scheduled_start: record.scheduledStart || null,
    scheduled_end: record.scheduledEnd || null,
    break_minutes: Number(record.breakMinutes) || 0,
    status: record.status || 'normal',
  };
  if (attendanceEarlyOvertimeColumnSupported) row.early_overtime = !!record.earlyOvertime;

  const { error } = await supabaseClient.from('attendance_records')
    .upsert(row, { onConflict: 'employee_id,ym,day' });
  if (!error) return;
  if (!(attendanceEarlyOvertimeColumnSupported && isMissingEarlyOvertimeColumnError(error))) throw error;

  attendanceEarlyOvertimeColumnSupported = false;
  delete row.early_overtime;
  const { error: retryError } = await supabaseClient.from('attendance_records')
    .upsert(row, { onConflict: 'employee_id,ym,day' });
  if (retryError) throw retryError;
}

// 指定期間（両端含む、'YYYY-MM-DD'形式）に日次勤怠入力でステータスが「有給休暇」
// となっている日数を数える（有給休暇管理簿の取得日数の算定に使用。半日単位には
// 対応していないため、1日単位の取得としてカウントする）
async function countPaidLeaveDaysBetween(employeeId, startDateStr, endDateStr) {
  const { data, error } = await supabaseClient.from('attendance_records').select('ym, day, status')
    .eq('employee_id', employeeId).eq('status', 'paid_leave');
  if (error) throw error;
  return data.filter((row) => {
    const dateStr = `${row.ym}-${String(row.day).padStart(2, '0')}`;
    return dateStr >= startDateStr && dateStr <= endDateStr;
  }).length;
}

function ymKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

// 期間内の各日について実際の(ym, day)に対応する勤怠レコードを取得し、
// 1始まりの連番でまとめ直す（月をまたぐ期間の場合は関係する月の分だけ
// getMonthAttendanceを呼び出してマージする）
async function fetchPeriodRecords(employeeId, periodDates) {
  const yms = [...new Set(periodDates.map((date) => ymKey(date.y, date.m)))];
  const byYm = {};
  for (const ym of yms) {
    byYm[ym] = await getMonthAttendance(employeeId, ym);
  }
  const records = {};
  periodDates.forEach((date, i) => {
    const rec = byYm[ymKey(date.y, date.m)][String(date.d)];
    if (rec) records[String(i + 1)] = rec;
  });
  return records;
}

// periodDatesの週残業・週深夜残業を、月・期間をまたぐ週も正しく計上できるよう
// 計算する。periodDatesの先頭が週の途中から始まる場合、その週の起算日まで
// 遡って前月分の実績を取得・合算した上でcomputeWeeklyOvertimeByDayを呼び出す
// （calcLeadingWeekPadDates参照。末尾が週の途中で終わる場合はcomputeWeeklyOvertimeByDay
// 側の仕様によりその週は0として返され、その週の最終日を含む次の期間の計算時に
// 同様の遡り処理によって正しく計上される）。
// records: 呼び出し側がすでに取得済みのperiodDates分の勤怠記録（fetchPeriodRecordsの
// 戻り値と同じ形式）。ここでは前月分の追加取得のみ行い、二重取得はしない。
// company: 渡された場合、打刻の丸め設定を出勤・退勤時刻に適用する
// defaultScheduledStart: 従業員マスタの所定始業時刻（所定始業時刻丸めの基準）
async function computeWeeklyOvertimeWithPadding(employeeId, periodDates, records, overtimeCategoryPerDay, weekStartDay, weeklyOvertimeThreshold, company, defaultScheduledStart) {
  if (!periodDates.length) return {};
  const leadingPad = calcLeadingWeekPadDates(periodDates[0], weekStartDay);
  if (!leadingPad.length) {
    return computeWeeklyOvertimeByDay(records, overtimeCategoryPerDay, periodDates, weekStartDay, weeklyOvertimeThreshold, company, defaultScheduledStart);
  }

  const padYm = ymKey(leadingPad[0].y, leadingPad[0].m);
  const padMonthRecords = await getMonthAttendance(employeeId, padYm);
  const padDaysInMonth = new Date(leadingPad[0].y, leadingPad[0].m, 0).getDate();
  const { perDay: padMonthPerDay } = computeOvertimeCategoryBreakdown(padMonthRecords, padDaysInMonth, company, defaultScheduledStart);

  const extendedDates = leadingPad.concat(periodDates);
  const extendedRecords = {};
  const extendedPerDay = {};
  leadingPad.forEach((date, i) => {
    const rec = padMonthRecords[String(date.d)];
    if (rec) extendedRecords[String(i + 1)] = rec;
    extendedPerDay[i + 1] = padMonthPerDay[date.d];
  });
  periodDates.forEach((date, i) => {
    const idx = leadingPad.length + i + 1;
    const rec = records[String(i + 1)];
    if (rec) extendedRecords[String(idx)] = rec;
    extendedPerDay[idx] = overtimeCategoryPerDay[i + 1];
  });

  const extendedResult = computeWeeklyOvertimeByDay(extendedRecords, extendedPerDay, extendedDates, weekStartDay, weeklyOvertimeThreshold, company, defaultScheduledStart);

  const result = {};
  periodDates.forEach((date, i) => {
    result[i + 1] = extendedResult[leadingPad.length + i + 1];
  });
  return result;
}

function timeToMinutes(t) {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

const ATTENDANCE_STATUS_LABELS = {
  normal: '通常',
  paid_leave: '有給休暇',
  absence: '欠勤',
  scheduled_holiday_work: '所定休日',
  statutory_holiday_work: '法定休日',
  holiday_work: '休日出勤（旧）', // 旧データ互換用。以後は所定休日／法定休日のいずれかで記録される
};

// 従業員の所定労働設定をもとに、1か月分の勤怠から集計値を計算する。
// companyを渡すと、会社マスタ管理の「週の起算日」「週法定外労働時間」に基づく
// 週残業・週深夜残業時間の当月合計もoventimeCategoryMonthTotalsに含める
// （固定残業代の計算等、週残業分も含めた区分別合計が必要な場面で使用する）。
async function computeMonthSummary(employee, ym, company) {
  const records = await getMonthAttendance(employee.id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const standardDailyMinutes = (employee.standardDailyHours || 8) * 60;
  const defaultStdStartMin = timeToMinutes(employee.workStart || '09:00');
  const defaultStdEndMin = timeToMinutes(employee.workEnd || '18:00');

  let workedMinutesTotal = 0;
  let overtimeMinutesTotal = 0;
  let lateMinutesTotal = 0;
  let earlyLeaveMinutesTotal = 0;
  let absenceDays = 0;
  let paidLeaveDays = 0;
  let holidayWorkDays = 0;
  let workDays = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const rec = records[String(d)];
    if (!rec) continue;
    if (rec.status === 'absence') { absenceDays++; continue; }
    if (rec.status === 'paid_leave') { paidLeaveDays++; continue; }

    const inMin = roundClockInMinutes(timeToMinutes(rec.clockIn), company, scheduledStartMinutesForRounding(rec, employee.workStart));
    const outMin = roundClockOutMinutes(timeToMinutes(rec.clockOut), company);
    if (inMin === null || outMin === null) continue;

    const breakMin = Number(rec.breakMinutes) || 0;
    const worked = Math.max(0, outMin - inMin - breakMin);
    workedMinutesTotal += worked;
    workDays++;

    if (isScheduledHolidayStatus(rec.status) || isStatutoryHolidayStatus(rec.status)) {
      holidayWorkDays++;
      overtimeMinutesTotal += worked; // 休日出勤分は全時間を割増対象の残業として扱う
      continue;
    }

    const stdStartMin = timeToMinutes(rec.scheduledStart) ?? defaultStdStartMin;
    const stdEndMin = timeToMinutes(rec.scheduledEnd) ?? defaultStdEndMin;
    if (inMin > stdStartMin) { lateMinutesTotal += (inMin - stdStartMin); lateCount++; }
    if (outMin < stdEndMin && worked < standardDailyMinutes) { earlyLeaveMinutesTotal += (stdEndMin - outMin); earlyLeaveCount++; }
    if (worked > standardDailyMinutes) overtimeMinutesTotal += (worked - standardDailyMinutes);
  }

  const { perDay: overtimeCategoryPerDay, monthTotals: overtimeCategoryMonthTotals } =
    computeOvertimeCategoryBreakdown(records, daysInMonth, company, employee.workStart);

  if (company) {
    const periodDates = buildCalendarMonthDates(y, m);
    const weeklyByDay = await computeWeeklyOvertimeWithPadding(
      employee.id, periodDates, records, overtimeCategoryPerDay, company.weekStartDay, company.weeklyOvertimeThreshold, company, employee.workStart
    );
    let weeklyOvertimeMonthTotal = 0;
    let weeklyOvertimeNightMonthTotal = 0;
    Object.values(weeklyByDay).forEach((w) => {
      weeklyOvertimeMonthTotal += w.weeklyOvertime;
      weeklyOvertimeNightMonthTotal += w.weeklyOvertimeNight;
    });
    overtimeCategoryMonthTotals.weeklyOvertime = weeklyOvertimeMonthTotal;
    overtimeCategoryMonthTotals.weeklyOvertimeNight = weeklyOvertimeNightMonthTotal;
  }

  return {
    ym,
    workDays,
    workedHours: workedMinutesTotal / 60,
    overtimeHours: overtimeMinutesTotal / 60,
    lateMinutes: lateMinutesTotal,
    lateCount,
    earlyLeaveMinutes: earlyLeaveMinutesTotal,
    earlyLeaveCount,
    absenceDays,
    paidLeaveDays,
    holidayWorkDays,
    overtimeCategoryPerDay,
    overtimeCategoryMonthTotals,
  };
}

// 労働基準法第36条に基づく時間外労働の上限（36協定の特別条項の有無にかかわらず
// 遵守しなければならない絶対的な上限）を、対象月を含む直近12か月分の勤怠集計から
// 概算でチェックする。判定対象：
//   (1) 時間外労働と休日労働（法定休日労働）の合計が、当月100時間以上
//   (2) 時間外労働と休日労働の合計の、直近2〜6か月平均のいずれかが80時間超
//   (3) 時間外労働（法定休日労働を除く）の直近12か月合計が720時間超
//   (4) 時間外労働（法定休日労働を除く）が月45時間を超えた月が、直近12か月で6か月を超えている
// 所定休日労働は時間外労働側に含め、法定休日労働のみを休日労働側に含める。
// 戻り値: 超過しているものについてのメッセージの配列（超過なしの場合は空配列）
async function checkOvertimeLimitWarnings(employee, ym, company) {
  const [y, m] = ym.split('-').map(Number);
  const months = [];
  for (let k = 0; k < 12; k++) {
    const d = new Date(y, m - 1 - k, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const summaries = await Promise.all(months.map((mm) => computeMonthSummary(employee, mm, company)));

  const stats = summaries.map((s) => {
    const cat = s.overtimeCategoryMonthTotals || {};
    const overtimeOnlyMin = (cat.overtimeWithin60 || 0) + (cat.overtimeOver60 || 0)
      + (cat.overtimeWithin60Night || 0) + (cat.overtimeOver60Night || 0)
      + (cat.weeklyOvertime || 0) + (cat.weeklyOvertimeNight || 0)
      + (cat.scheduledHoliday || 0);
    const holidayWorkMin = (cat.statutoryHoliday || 0) + (cat.statutoryHolidayNight || 0);
    return { overtimeOnlyMin, holidayWorkMin, combinedMin: overtimeOnlyMin + holidayWorkMin };
  });

  const warnings = [];
  const current = stats[0];

  const currentCombinedHours = current.combinedMin / 60;
  if (currentCombinedHours >= 100) {
    warnings.push(`時間外労働と休日労働の合計が今月${currentCombinedHours.toFixed(1)}時間となっており、労働基準法の上限（単月100時間未満）を超過しています。`);
  }

  let worstWindow = null;
  for (let w = 2; w <= 6; w++) {
    const sumMin = stats.slice(0, w).reduce((acc, s) => acc + s.combinedMin, 0);
    const avgHours = sumMin / w / 60;
    if (avgHours > 80 && (!worstWindow || avgHours > worstWindow.avgHours)) {
      worstWindow = { w, avgHours };
    }
  }
  if (worstWindow) {
    warnings.push(`時間外労働と休日労働の合計の直近${worstWindow.w}か月平均が${worstWindow.avgHours.toFixed(1)}時間となっており、労働基準法の上限（複数月平均80時間以内）を超過しています。`);
  }

  const year720Hours = stats.reduce((acc, s) => acc + s.overtimeOnlyMin, 0) / 60;
  if (year720Hours > 720) {
    warnings.push(`時間外労働の直近12か月合計が${year720Hours.toFixed(1)}時間となっており、労働基準法の上限（年720時間以内）を超過しています。`);
  }

  const monthsOver45 = stats.filter((s) => s.overtimeOnlyMin / 60 > 45).length;
  if (monthsOver45 > 6) {
    warnings.push(`時間外労働が月45時間を超えた月が、直近12か月で${monthsOver45}か月となっており、労働基準法の上限（月45時間を超えることができるのは年6か月まで）を超過しています。`);
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// 給与明細履歴（従業員ID × 年月をキーに1件保存）
// ---------------------------------------------------------------------------
async function savePayslip(employeeId, ym, data) {
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient.from('payslips').upsert({
    user_id: userId,
    employee_id: employeeId,
    ym,
    input: data.input,
    result: data.result,
    saved_at: new Date().toISOString(),
  }, { onConflict: 'employee_id,ym' });
  if (error) throw error;
}

async function getPayslip(employeeId, ym) {
  const { data, error } = await supabaseClient.from('payslips').select('*')
    .eq('employee_id', employeeId).eq('ym', ym).maybeSingle();
  if (error) throw error;
  return data ? { input: data.input, result: data.result, savedAt: data.saved_at } : null;
}

async function listPayslips(employeeId) {
  const { data, error } = await supabaseClient.from('payslips').select('*').eq('employee_id', employeeId);
  if (error) throw error;
  const result = {};
  for (const row of data) result[row.ym] = { input: row.input, result: row.result, savedAt: row.saved_at };
  return result;
}

async function deletePayslip(employeeId, ym) {
  const { error } = await supabaseClient.from('payslips').delete().eq('employee_id', employeeId).eq('ym', ym);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 賞与明細履歴（従業員ごとに複数件、複数回の賞与支給に対応）
// ---------------------------------------------------------------------------
function bonusRowToObj(row) {
  return { id: row.id, label: row.label || '', date: row.bonus_date || '', input: row.input, result: row.result };
}

async function listBonuses(employeeId) {
  const { data, error } = await supabaseClient.from('bonuses').select('*')
    .eq('employee_id', employeeId).order('bonus_date', { ascending: true });
  if (error) throw error;
  return data.map(bonusRowToObj);
}

async function saveBonusRecord(employeeId, bonusRecord) {
  if (bonusRecord.id) {
    const { data, error } = await supabaseClient.from('bonuses').update({
      label: bonusRecord.label || null,
      bonus_date: bonusRecord.date || null,
      input: bonusRecord.input,
      result: bonusRecord.result,
    }).eq('id', bonusRecord.id).select().single();
    if (error) throw error;
    return bonusRowToObj(data);
  }
  const userId = await getCurrentUserId();
  const { data, error } = await supabaseClient.from('bonuses').insert({
    user_id: userId,
    employee_id: employeeId,
    label: bonusRecord.label || null,
    bonus_date: bonusRecord.date || null,
    input: bonusRecord.input,
    result: bonusRecord.result,
  }).select().single();
  if (error) throw error;
  return bonusRowToObj(data);
}

async function deleteBonusRecord(employeeId, bonusId) {
  const { error } = await supabaseClient.from('bonuses').delete().eq('id', bonusId).eq('employee_id', employeeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 会社マスタ（保険料率設定。ログインユーザー1人＝会社1社の単一レコード）
// ---------------------------------------------------------------------------
// 勤怠丸め設定のデフォルト（打刻の丸め設定を参照。単位は分、method: 'up'=切り上げ/'down'=切り捨て）
function defaultRoundingRules() {
  return {
    clockIn: { minutes: 15, method: 'up' },
    clockOut: { minutes: 15, method: 'down' },
    breakStart: { minutes: 15, method: 'up' },
    breakEnd: { minutes: 15, method: 'down' },
  };
}

function defaultCompany() {
  return {
    branchName: '本社',
    isHeadOffice: true,
    companyName: '',
    statutoryHolidayWeekday: 0, // 0=日曜日 〜 6=土曜日
    scheduledHolidayWeekday: 6, // 0=日曜日 〜 6=土曜日
    weekStartDay: 0, // 0=日曜日 〜 6=土曜日（週の起算日）
    weeklyOvertimeThreshold: 40, // 週法定外労働時間の基準（40 または 44。特例措置対象事業場のみ44）
    paycheckClosingDay: 'end', // 1〜31 または 'end'（末日）
    paycheckPaymentDay: '25', // 1〜31 または 'end'（末日）
    healthInsuranceType: 'kyoukai',
    prefecture: '東京',
    healthRate: PREFECTURE_HEALTH_RATES['東京'],
    careRate: CARE_RATE_DEFAULT,
    pensionRate: PENSION_RATE_DEFAULT,
    industryType: '一般の事業',
    employmentRate: EMPLOYMENT_RATES_BY_INDUSTRY['一般の事業'],
    calcMethod: 'table',
    // 勤怠丸め設定（デフォルト無＝1分単位で計算。出勤・退勤のみ実際の計算に反映され、
    // 休憩開始・休憩終了は設定を保存するのみで計算には未反映）
    roundingEnabled: false,
    roundingRules: defaultRoundingRules(),
    // 所定始業時刻丸め（デフォルト無）。有効にすると、所定始業時刻より前の打刻を
    // 所定始業時刻に丸め、始業時刻前の勤務時間を集計の対象外とする
    // （勤怠管理で「早出残業」にチェックした日は丸めず、始業前の勤務も集計する）
    scheduledStartRounding: false,
    // 割増賃金計算における端数処理設定（労働基準局通達に基づく3項目。デフォルト適用なし）
    overtimeFractionRules: {
      monthlyHoursRounding: false, // (1) 月間の時間外・休日・深夜業時間数の30分未満切捨て・以上切上げ
      hourlyWageRounding: false, // (2) 時給・割増単価の50銭未満切捨て・以上切上げ
      monthlyPayRounding: false, // (3) 月間の時間外・休日・深夜業の割増賃金総額の50銭未満切捨て・以上切上げ
    },
    // 1か月の賃金支払額における端数処理設定（デフォルト適用なし）
    monthlyPaymentFractionRules: {
      round100: false, // (1) 賃金支払額の100円未満端数を50円未満切捨て・以上切上げ
      carryOver1000: false, // (2) 1,000円未満の端数を翌月の賃金支払日に繰り越して支払う
    },
    overtimeRates: defaultOvertimeRates(),
  };
}

function companyRowToObj(row) {
  const defaults = defaultCompany();
  const orNum = (v, fallback) => (v !== null && v !== undefined ? Number(v) : fallback);
  return {
    id: row.id,
    branchName: row.branch_name || defaults.branchName,
    isHeadOffice: !!row.is_head_office,
    companyName: row.company_name || defaults.companyName,
    statutoryHolidayWeekday: orNum(row.statutory_holiday_weekday, defaults.statutoryHolidayWeekday),
    scheduledHolidayWeekday: orNum(row.scheduled_holiday_weekday, defaults.scheduledHolidayWeekday),
    weekStartDay: orNum(row.week_start_day, defaults.weekStartDay),
    weeklyOvertimeThreshold: orNum(row.weekly_overtime_threshold, defaults.weeklyOvertimeThreshold),
    paycheckClosingDay: row.paycheck_closing_day || defaults.paycheckClosingDay,
    paycheckPaymentDay: row.paycheck_payment_day || defaults.paycheckPaymentDay,
    healthInsuranceType: row.health_insurance_type || defaults.healthInsuranceType,
    prefecture: row.prefecture || defaults.prefecture,
    healthRate: orNum(row.health_rate, defaults.healthRate),
    careRate: orNum(row.care_rate, defaults.careRate),
    pensionRate: orNum(row.pension_rate, defaults.pensionRate),
    industryType: row.industry_type || defaults.industryType,
    employmentRate: orNum(row.employment_rate, defaults.employmentRate),
    calcMethod: row.calc_method || defaults.calcMethod,
    roundingEnabled: row.rounding_enabled !== null && row.rounding_enabled !== undefined ? !!row.rounding_enabled : defaults.roundingEnabled,
    roundingRules: row.rounding_rules || defaults.roundingRules,
    // 所定始業時刻丸めは勤怠丸め設定（rounding_rules）のJSONに同居させている
    // （DBの列追加を不要にするため）
    scheduledStartRounding: !!(row.rounding_rules && row.rounding_rules.scheduledStartRounding),
    overtimeFractionRules: row.overtime_fraction_rules || defaults.overtimeFractionRules,
    monthlyPaymentFractionRules: row.monthly_payment_fraction_rules || defaults.monthlyPaymentFractionRules,
    overtimeRates: row.overtime_rates || defaultOvertimeRates(),
    sortOrder: row.sort_order,
  };
}

function companyObjToRow(company, userId) {
  return {
    user_id: userId,
    branch_name: company.branchName || '本社',
    is_head_office: !!company.isHeadOffice,
    company_name: company.companyName || null,
    statutory_holiday_weekday: company.statutoryHolidayWeekday,
    scheduled_holiday_weekday: company.scheduledHolidayWeekday,
    week_start_day: company.weekStartDay,
    weekly_overtime_threshold: company.weeklyOvertimeThreshold,
    paycheck_closing_day: String(company.paycheckClosingDay || 'end'),
    paycheck_payment_day: String(company.paycheckPaymentDay || 'end'),
    health_insurance_type: company.healthInsuranceType,
    prefecture: company.prefecture,
    health_rate: company.healthRate,
    care_rate: company.careRate,
    pension_rate: company.pensionRate,
    industry_type: company.industryType,
    employment_rate: company.employmentRate,
    calc_method: company.calcMethod,
    rounding_enabled: !!company.roundingEnabled,
    rounding_rules: Object.assign({}, company.roundingRules || defaultRoundingRules(),
      { scheduledStartRounding: !!company.scheduledStartRounding }),
    overtime_fraction_rules: company.overtimeFractionRules || {},
    monthly_payment_fraction_rules: company.monthlyPaymentFractionRules || {},
    overtime_rates: company.overtimeRates || defaultOvertimeRates(),
    sort_order: company.sortOrder,
    updated_at: new Date().toISOString(),
  };
}

// 会社マスタ（本社・支社ごとに複数レコードを持てる）。
// サインアップ直後などまだ1件も登録がない場合は、本社レコードをデフォルト値で
// 自動作成する（従来の単一会社設定と同じ挙動をユーザーが意識せず使えるようにするため）。
async function ensureHeadOfficeBranch() {
  const userId = await getCurrentUserId();
  const row = companyObjToRow(Object.assign(defaultCompany(), { sortOrder: 1 }), userId);
  const { data, error } = await supabaseClient.from('company_branches').insert(row).select().single();
  if (error) throw error;
  return companyRowToObj(data);
}

async function listBranches() {
  const { data, error } = await supabaseClient.from('company_branches').select('*')
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  if (!data || !data.length) {
    const head = await ensureHeadOfficeBranch();
    return [head];
  }
  return data.map(companyRowToObj);
}

// branchIdを指定するとその支社の設定を返す（存在しなければ本社設定にフォールバック）。
// 指定しない場合は本社の設定を返す。本社レコードが1件も無い場合は自動作成する。
async function getCompany(branchId) {
  if (branchId) {
    const { data, error } = await supabaseClient.from('company_branches').select('*').eq('id', branchId).maybeSingle();
    if (error) throw error;
    if (data) return companyRowToObj(data);
  }
  const { data, error } = await supabaseClient.from('company_branches').select('*').eq('is_head_office', true).maybeSingle();
  if (error) throw error;
  if (data) return companyRowToObj(data);
  return await ensureHeadOfficeBranch();
}

// branch.idが未設定なら新規追加、設定済みなら更新。更新時は変更履歴を記録する
async function saveBranch(branch) {
  const userId = await getCurrentUserId();
  const row = companyObjToRow(branch, userId);
  if (branch.id) {
    const { data: oldData, error: oldError } = await supabaseClient.from('company_branches').select('*').eq('id', branch.id).maybeSingle();
    if (oldError) throw oldError;
    const { data, error } = await supabaseClient.from('company_branches').update(row).eq('id', branch.id).select().single();
    if (error) throw error;
    const updated = companyRowToObj(data);
    if (oldData) {
      const changes = diffFields(companyRowToObj(oldData), updated, COMPANY_HISTORY_FIELDS);
      await recordChangeHistory('company_branch', branch.id, updated.branchName, changes);
    }
    return updated;
  }
  const { data, error } = await supabaseClient.from('company_branches').insert(row).select().single();
  if (error) throw error;
  return companyRowToObj(data);
}

// 本社の設定内容をすべて引き継いだ新しい支社を作成する
// （デフォルト反映後、各項目の変更・修正は通常のsaveBranchで行う）
async function createBranchFromHeadOffice(branchName) {
  const [head, existingBranches] = await Promise.all([getCompany(), listBranches()]);
  const maxSortOrder = existingBranches.reduce((max, b) => Math.max(max, Number(b.sortOrder) || 0), 0);
  const newBranch = Object.assign({}, head, {
    id: undefined, branchName: branchName || '', isHeadOffice: false, sortOrder: maxSortOrder + 1,
  });
  return await saveBranch(newBranch);
}

async function deleteBranch(branchId) {
  const { error } = await supabaseClient.from('company_branches').delete().eq('id', branchId);
  if (error) throw error;
}

// 支社一覧の並び順（No.）のみを更新する。他の設定項目には影響しない。
async function updateBranchSortOrder(branchId, sortOrder) {
  const { error } = await supabaseClient.from('company_branches').update({ sort_order: sortOrder }).eq('id', branchId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 変更履歴（会社マスタ・従業員マスタを更新した際に、項目単位で変更前後の
// 値を記録する。新規登録時は記録しない）
// ---------------------------------------------------------------------------
const HISTORY_WEEKDAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
function fmtHistoryWeekday(v) { return HISTORY_WEEKDAY_LABELS[Number(v)] ?? ''; }
function fmtHistoryYesNo(v) { return v ? '有' : '無'; }
function fmtHistoryPercent(v) { return (v === null || v === undefined || v === '') ? '' : `${Number(v).toFixed(2)}%`; }
function fmtHistoryDay(v) { return v === null || v === undefined || v === '' ? '' : (v === 'end' ? '末日' : `${v}日`); }
function fmtHistoryYen(v) { return (v === null || v === undefined || v === '') ? '' : `${Number(v).toLocaleString()}円`; }
function fmtHistoryRoundingRule(rule) {
  if (!rule) return '';
  return `${rule.minutes}分単位（${rule.method === 'down' ? '切り捨て' : '切り上げ'}）`;
}

// oldObj/newObjをdefsで定義した項目ごとに比較し、値が変わった項目だけを
// { label, before, after } の配列として返す（同値なら結果に含めない）
function diffFields(oldObj, newObj, defs) {
  const changes = [];
  defs.forEach((def) => {
    const beforeRaw = def.get ? def.get(oldObj) : oldObj[def.key];
    const afterRaw = def.get ? def.get(newObj) : newObj[def.key];
    if (JSON.stringify(beforeRaw ?? null) === JSON.stringify(afterRaw ?? null)) return;
    const before = def.format ? def.format(beforeRaw) : (beforeRaw ?? '');
    const after = def.format ? def.format(afterRaw) : (afterRaw ?? '');
    changes.push({ label: def.label, before: String(before), after: String(after) });
  });
  return changes;
}

const COMPANY_HISTORY_FIELDS = [
  { key: 'branchName', label: '支社名' },
  { key: 'companyName', label: '会社名' },
  { key: 'statutoryHolidayWeekday', label: '法定休日', format: fmtHistoryWeekday },
  { key: 'scheduledHolidayWeekday', label: '所定休日', format: fmtHistoryWeekday },
  { key: 'weekStartDay', label: '週の起算日', format: fmtHistoryWeekday },
  { key: 'weeklyOvertimeThreshold', label: '週法定外労働時間', format: (v) => (v || v === 0) ? `週${v}時間` : '' },
  { key: 'paycheckClosingDay', label: '賃金締日', format: fmtHistoryDay },
  { key: 'paycheckPaymentDay', label: '賃金支払日', format: fmtHistoryDay },
  { key: 'healthInsuranceType', label: '健康保険の種類', format: (v) => v === 'kumiai' ? '健康保険組合' : (v ? '協会けんぽ' : '') },
  { key: 'prefecture', label: '都道府県' },
  { key: 'healthRate', label: '健康保険料率', format: fmtHistoryPercent },
  { key: 'careRate', label: '介護保険料率', format: fmtHistoryPercent },
  { key: 'pensionRate', label: '厚生年金保険料率', format: fmtHistoryPercent },
  { key: 'industryType', label: '事業の種類（雇用保険）' },
  { key: 'employmentRate', label: '雇用保険料率', format: fmtHistoryPercent },
  { key: 'calcMethod', label: '源泉所得税の計算方法', format: (v) => v === 'machine' ? '機械計算' : (v ? '月額表' : '') },
  { key: 'roundingEnabled', label: '打刻時刻の丸め', format: fmtHistoryYesNo },
  { key: 'scheduledStartRounding', label: '所定始業時刻丸め', format: fmtHistoryYesNo },
];
[['clockIn', '出勤'], ['clockOut', '退勤'], ['breakStart', '休憩開始'], ['breakEnd', '休憩終了']].forEach(([kind, label]) => {
  COMPANY_HISTORY_FIELDS.push({
    key: `roundingRules.${kind}`,
    label: `勤怠丸め設定（${label}）`,
    get: (c) => c.roundingRules && c.roundingRules[kind],
    format: fmtHistoryRoundingRule,
  });
});
COMPANY_HISTORY_FIELDS.push(
  { key: 'overtimeFractionRules.monthlyHoursRounding', label: '端数処理(1) 月間時間数の30分未満切捨て',
    get: (c) => c.overtimeFractionRules && c.overtimeFractionRules.monthlyHoursRounding, format: fmtHistoryYesNo },
  { key: 'overtimeFractionRules.hourlyWageRounding', label: '端数処理(2) 時給・割増単価の50銭未満切捨て',
    get: (c) => c.overtimeFractionRules && c.overtimeFractionRules.hourlyWageRounding, format: fmtHistoryYesNo },
  { key: 'overtimeFractionRules.monthlyPayRounding', label: '端数処理(3) 割増賃金総額の50銭未満切捨て',
    get: (c) => c.overtimeFractionRules && c.overtimeFractionRules.monthlyPayRounding, format: fmtHistoryYesNo },
  { key: 'monthlyPaymentFractionRules.round100', label: '賃金支払額端数処理(1) 100円未満端数処理',
    get: (c) => c.monthlyPaymentFractionRules && c.monthlyPaymentFractionRules.round100, format: fmtHistoryYesNo },
  { key: 'monthlyPaymentFractionRules.carryOver1000', label: '賃金支払額端数処理(2) 1,000円未満繰越',
    get: (c) => c.monthlyPaymentFractionRules && c.monthlyPaymentFractionRules.carryOver1000, format: fmtHistoryYesNo },
);
OVERTIME_RATE_CATEGORIES.forEach((cat) => {
  COMPANY_HISTORY_FIELDS.push({
    key: `overtimeRates.${cat.key}`,
    label: `割増率（${cat.label}）`,
    get: (c) => c.overtimeRates && c.overtimeRates[cat.key],
    format: (v) => (v === null || v === undefined || v === '') ? '' : `${Number(v).toFixed(2)}倍`,
  });
});

function buildEmployeeHistoryFields(branchNameById) {
  return [
    { key: 'employeeNumber', label: '従業員番号' },
    { key: 'branchId', label: '所属支社', format: (id) => (id && branchNameById[id]) || '' },
    { key: 'department', label: '部署名' },
    { key: 'name', label: '氏名' },
    { key: 'nameKana', label: 'フリガナ' },
    { key: 'gender', label: '性別' },
    { key: 'genderOther', label: '性別（その他）' },
    { key: 'employeeCode', label: '勤怠打刻用ユーザーID' },
    { key: 'employmentType', label: '雇用形態' },
    { key: 'hireDate', label: '入社日' },
    { key: 'birthDate', label: '生年月日' },
    { key: 'baseSalary', label: '基本給', format: fmtHistoryYen },
    { key: 'fixedOvertimeEnabled', label: '固定残業代の有無', format: fmtHistoryYesNo },
    { key: 'fixedOvertimeAllowanceName', label: '固定残業代の手当名称' },
    { key: 'fixedOvertimeMonthlyHours', label: '固定残業時間数', format: (v) => (v || v === 0) ? `${v}時間` : '' },
    { key: 'fixedOvertimeAmount', label: '固定残業代の金額', format: fmtHistoryYen },
    { key: 'commuteAllowance', label: '通勤手当', format: fmtHistoryYen },
    { key: 'commuteAllowanceExcludeFromOvertimeBase', label: '通勤手当を割増賃金基礎から除外', format: fmtHistoryYesNo },
    { key: 'dependents', label: '扶養親族等の数', format: (v) => (v || v === 0) ? `${v}人` : '' },
    { key: 'taxTable', label: '甲欄・乙欄' },
    { key: 'workStart', label: '所定始業時刻' },
    { key: 'workEnd', label: '所定終業時刻' },
    { key: 'standardDailyHours', label: '1日の所定労働時間', format: (v) => (v || v === 0) ? `${v}時間` : '' },
    { key: 'weeklyScheduledDays', label: '週の所定労働日数', format: (v) => (v || v === 0) ? `${v}日` : '' },
    { key: 'monthlyStandardHours', label: '月平均所定労働時間', format: (v) => (v || v === 0) ? `${v}時間` : '' },
    { key: 'monthlyStandardDays', label: '月平均所定労働日数', format: (v) => (v || v === 0) ? `${v}日` : '' },
    { key: 'healthInsuranceNumber', label: '健保番号' },
    { key: 'healthStandardMonthly', label: '標準報酬月額（健保）', format: fmtHistoryYen },
    { key: 'pensionStandardMonthly', label: '標準報酬月額（厚年）', format: fmtHistoryYen },
    { key: 'allowances', label: 'その他手当',
      format: (arr) => (arr && arr.length) ? arr.map((a) => `${a.name} ${fmtHistoryYen(a.amount)}`).join('、') : 'なし' },
  ];
}

async function recordChangeHistory(targetType, targetId, targetLabel, changes) {
  if (!changes || !changes.length) return;
  const userId = await getCurrentUserId();
  const { error } = await supabaseClient.from('change_history').insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
    target_label: targetLabel || null,
    changes,
  });
  if (error) throw error;
}

async function listChangeHistory(targetType, targetId) {
  const { data, error } = await supabaseClient.from('change_history').select('*')
    .eq('target_type', targetType).eq('target_id', targetId).order('changed_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    targetLabel: row.target_label,
    changes: row.changes || [],
    changedAt: row.changed_at,
  }));
}

// ---------------------------------------------------------------------------
// ダッシュボード集計用ヘルパー
// ---------------------------------------------------------------------------
function currentYm() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}
