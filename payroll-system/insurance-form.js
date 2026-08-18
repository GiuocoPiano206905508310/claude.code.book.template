// ============================================================================
// 算定基礎届・月額変更届の様式（Excel）への差し込み内容を組み立てる
//
// セル番地は日本年金機構の様式ファイル（forms/santei.xlsx・forms/geppen.xlsx）
// のレイアウトに対応している。1枚につき5人分の記入欄があり、2人目以降は
// 1人目のブロックを一定行数ずつ下にずらした位置になる。
// ============================================================================

// ---------------------------------------------------------------------------
// 算定基礎届（forms/santei.xlsx）: 1人目は69行目から、以降30行ごと・1枚5人まで
// ---------------------------------------------------------------------------
const SANTEI_FORM = {
  templateUrl: 'forms/santei.xlsx',
  firstRow: 69,
  rowPitch: 30,
  perSheet: 5,
  header: {
    submitYear: 'H4', submitMonth: 'O4', submitDay: 'V4', // ①提出日（令和）
    officeName: 'M29', // 事業所名称
    officeAddress: 'M19', // 事業所所在地
    ownerName: 'M38', // 事業主氏名
  },
  // 1人目のブロックを基準にした、項目ごとのセル番地（行は firstRow からの相対）
  fields: {
    insuranceNumber: { cell: 'F', offset: 0 },   // ①被保険者整理番号
    name: { cell: 'T', offset: 0 },              // ②被保険者氏名
    birthDate: { cell: 'BC', offset: 0 },        // ③生年月日
    applyYear: { cell: 'BW', offset: 0 },        // ④適用年月（令和・月は様式に9が印字済み）
    prevHealth: { cell: 'I', offset: 8 },        // ⑤従前の標準報酬月額（健保・千円）
    prevPension: { cell: 'X', offset: 8 },       // ⑤従前の標準報酬月額（厚年・千円）
    month1: { cell: 'F', offset: 14 },           // ⑨支給月（4月）
    days1: { cell: 'K', offset: 14 },            // ⑩支払基礎日数
    cash1: { cell: 'V', offset: 14 },            // ⑪通貨によるものの額
    inKind1: { cell: 'AK', offset: 14 },         // ⑫現物によるものの額
    month2: { cell: 'F', offset: 18 },
    days2: { cell: 'K', offset: 18 },
    cash2: { cell: 'V', offset: 18 },
    inKind2: { cell: 'AK', offset: 18 },
    month3: { cell: 'F', offset: 24 },
    days3: { cell: 'K', offset: 24 },
    cash3: { cell: 'V', offset: 24 },
    inKind3: { cell: 'AK', offset: 24 },
    total: { cell: 'BO', offset: 14 },           // ⑭総計
    average: { cell: 'BO', offset: 20 },         // ⑮平均額
  },
};

// ---------------------------------------------------------------------------
// 月額変更届（forms/geppen.xlsx）: 1人目は64行目から、以降31行ごと・1枚5人まで
// ⑬合計・⑭総計・⑮平均額は様式に数式が入っているため差し込まない
// ---------------------------------------------------------------------------
const GEPPEN_FORM = {
  templateUrl: 'forms/geppen.xlsx',
  firstRow: 64,
  rowPitch: 31,
  perSheet: 5,
  header: {
    submitYear: 'I4', submitMonth: 'P4', submitDay: 'V4',
    officeName: 'J26',
    officeAddress: 'J18',
    ownerName: 'J36',
  },
  fields: {
    insuranceNumber: { cell: 'C', offset: 0 },   // ①被保険者整理番号
    name: { cell: 'R', offset: 0 },              // ②被保険者氏名
    birthDate: { cell: 'AV', offset: 0 },        // ③生年月日
    applyYear: { cell: 'BU', offset: 0 },        // ④改定年月（令和）
    applyMonth: { cell: 'CB', offset: 0 },
    prevHealth: { cell: 'F', offset: 6 },        // ⑤従前の標準報酬月額（健保・千円）
    prevPension: { cell: 'U', offset: 6 },       // ⑤従前の標準報酬月額（厚年・千円）
    raiseMonth: { cell: 'AV', offset: 8 },       // ⑦昇（降）給月
    month1: { cell: 'C', offset: 14 },           // ⑨支給月
    days1: { cell: 'H', offset: 14 },
    cash1: { cell: 'R', offset: 14 },
    inKind1: { cell: 'AG', offset: 14 },
    month2: { cell: 'C', offset: 18 },
    days2: { cell: 'H', offset: 18 },
    cash2: { cell: 'R', offset: 18 },
    inKind2: { cell: 'AG', offset: 18 },
    month3: { cell: 'C', offset: 24 },
    days3: { cell: 'H', offset: 24 },
    cash3: { cell: 'R', offset: 24 },
    inKind3: { cell: 'AG', offset: 24 },
  },
};

// 標準報酬月額は様式上「千円」単位で記入する
// 0円の欄は空欄のままにする（様式では0を記入しない）
function orBlank(amount) {
  const value = Number(amount);
  return value ? value : '';
}

function toThousandYen(amount) {
  const value = Number(amount) || 0;
  return value ? Math.round(value / 1000) : '';
}

// 様式の1人分のブロックに値を割り当てる
function assignFormBlock(form, index, values, target) {
  const row = form.firstRow + (index % form.perSheet) * form.rowPitch;
  for (const [key, value] of Object.entries(values)) {
    const field = form.fields[key];
    if (!field || value === '' || value === null || value === undefined) continue;
    target[`${field.cell}${row + field.offset}`] = value;
  }
}

// 事業所情報・提出日（会社マスタ管理で分かる内容のみ）
function assignFormHeader(form, company, target, submitDate) {
  const date = submitDate || new Date();
  target[form.header.submitYear] = toReiwaYear(date.getFullYear());
  target[form.header.submitMonth] = date.getMonth() + 1;
  target[form.header.submitDay] = date.getDate();
  if (company && company.companyName) target[form.header.officeName] = company.companyName;
}

// ---------------------------------------------------------------------------
// 算定基礎届：対象者の一覧から差し込み内容（1枚分・5人まで）を組み立てる
// ---------------------------------------------------------------------------
function buildSanteiFormValues(entries, company, submitDate) {
  const values = {};
  assignFormHeader(SANTEI_FORM, company, values, submitDate);
  entries.slice(0, SANTEI_FORM.perSheet).forEach((entry, i) => {
    // 給与明細が無い月は空欄のままにする（0を記入しない）
    const [m1, m2, m3] = entry.months.map((m) => (m.hasSlip ? m : {
      month: m.month, basisDays: '', cashRemuneration: '', inKindRemuneration: '',
    }));
    assignFormBlock(SANTEI_FORM, i, {
      insuranceNumber: entry.insuranceNumber,
      name: entry.employeeName,
      birthDate: formatBirthDateForForm(entry.birthDate),
      applyYear: toReiwaYear(Number(entry.applyYm.split('-')[0])),
      prevHealth: toThousandYen(entry.currentHealthStandardMonthly),
      prevPension: toThousandYen(entry.currentPensionStandardMonthly),
      month1: m1.month, days1: m1.basisDays, cash1: m1.cashRemuneration, inKind1: orBlank(m1.inKindRemuneration),
      month2: m2.month, days2: m2.basisDays, cash2: m2.cashRemuneration, inKind2: orBlank(m2.inKindRemuneration),
      month3: m3.month, days3: m3.basisDays, cash3: m3.cashRemuneration, inKind3: orBlank(m3.inKindRemuneration),
      total: entry.total || '',
      average: entry.averageRemuneration || '',
    }, values);
  });
  return values;
}

// ---------------------------------------------------------------------------
// 月額変更届：随時改定の対象者から差し込み内容（1枚分・5人まで）を組み立てる
// ---------------------------------------------------------------------------
function buildGeppenFormValues(notices, company, submitDate) {
  const values = {};
  assignFormHeader(GEPPEN_FORM, company, values, submitDate);
  notices.slice(0, GEPPEN_FORM.perSheet).forEach((notice, i) => {
    const [m1, m2, m3] = notice.months;
    const [revYear, revMonth] = notice.revisionYm.split('-').map(Number);
    assignFormBlock(GEPPEN_FORM, i, {
      insuranceNumber: notice.insuranceNumber,
      name: notice.employeeName,
      birthDate: formatBirthDateForForm(notice.birthDate),
      applyYear: toReiwaYear(revYear),
      applyMonth: revMonth,
      prevHealth: toThousandYen(notice.currentHealthStandardMonthly),
      prevPension: toThousandYen(notice.currentPensionStandardMonthly),
      raiseMonth: Number(notice.startYm.split('-')[1]),
      month1: m1.paymentMonth, days1: m1.basisDays, cash1: m1.cashRemuneration, inKind1: orBlank(m1.inKindRemuneration),
      month2: m2.paymentMonth, days2: m2.basisDays, cash2: m2.cashRemuneration, inKind2: orBlank(m2.inKindRemuneration),
      month3: m3.paymentMonth, days3: m3.basisDays, cash3: m3.cashRemuneration, inKind3: orBlank(m3.inKindRemuneration),
    }, values);
  });
  return values;
}
