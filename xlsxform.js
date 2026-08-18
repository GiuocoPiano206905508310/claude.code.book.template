// ============================================================================
// Excel様式（.xlsx）への自動入力エンジン
//
// 日本年金機構の様式ファイル（forms/santei.xlsx・forms/geppen.xlsx）をそのまま
// 読み込み、シートXMLのセルに値を差し込んで再びxlsxとして書き出す。様式の
// レイアウト・罫線・数式・画像はテンプレートのまま保持される。
//
// xlsxはZIPファイルなので、ブラウザ標準のDecompressionStream/CompressionStream
// （deflate-raw）だけでZIPの読み書きを行い、外部ライブラリは使用しない。
// ============================================================================

// ---------------------------------------------------------------------------
// CRC32（ZIPのチェックサム）
// ---------------------------------------------------------------------------
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// ZIPの読み込み（中央ディレクトリを走査して全エントリを取り出す）
// ---------------------------------------------------------------------------
async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // End of Central Directory を末尾から探す
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIPの形式が正しくありません（End of Central Directoryが見つかりません）');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIPの中央ディレクトリが壊れています');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    // ローカルヘッダから実データの位置を求める
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    entries.push({ name, method, raw });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  const files = [];
  for (const e of entries) {
    const data = e.method === 0 ? e.raw.slice() : await inflateRaw(e.raw);
    files.push({ name: e.name, data });
  }
  return files;
}

// ---------------------------------------------------------------------------
// ZIPの書き出し（すべてdeflateで格納する）
// ---------------------------------------------------------------------------
async function zip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const compressed = await deflateRaw(file.data);
    const crc = crc32(file.data);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8のファイル名
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    locals.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length;
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...locals, ...central, end],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------------------------------------------------------------------------
// シートXMLへの値の差し込み
// ---------------------------------------------------------------------------
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// values: { 'F69': 12, 'T69': '山田 太郎', ... }（数値はそのまま、文字列はinlineStrで格納）
// テンプレートには対象セルが <c r="F69" s="209"/> の形で既に存在するため、
// 属性（＝書式）を保ったまま値だけを差し込む。
function fillSheetCells(xml, values) {
  let result = xml;
  const missing = [];
  for (const [ref, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') continue;
    const pattern = new RegExp(`<c r="${ref}"((?:\\s+[a-zA-Z]+="[^"]*")*)\\s*(?:/>|>[\\s\\S]*?</c>)`);
    if (!pattern.test(result)) { missing.push(ref); continue; }
    result = result.replace(pattern, (match, attrs) => {
      // 値の型に応じた属性（t）を差し替える
      const baseAttrs = attrs.replace(/\s+t="[^"]*"/g, '');
      if (typeof value === 'number') {
        return `<c r="${ref}"${baseAttrs}><v>${value}</v></c>`;
      }
      return `<c r="${ref}"${baseAttrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    });
  }
  return { xml: result, missing };
}

// ブックを開いたときに数式（⑬合計・⑮平均額など）が再計算されるようにする
function enableFullCalcOnLoad(workbookXml) {
  if (/<calcPr[^>]*\/>/.test(workbookXml)) {
    return workbookXml.replace(/<calcPr([^>]*)\/>/, (m, attrs) =>
      `<calcPr${attrs.replace(/\s+fullCalcOnLoad="[^"]*"/g, '')} fullCalcOnLoad="1"/>`);
  }
  return workbookXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
}

// ---------------------------------------------------------------------------
// テンプレートを読み込み、値を差し込んだxlsxのBlobを返す
// templateUrl: 様式ファイルのURL、values: { セル番地: 値 }
// ---------------------------------------------------------------------------
async function fillXlsxTemplate(templateUrl, values) {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error(`様式ファイルを読み込めませんでした（${response.status}）`);
  const files = await unzip(await response.arrayBuffer());

  const sheet = files.find((f) => f.name === 'xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('様式ファイルにシートが見つかりません');
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const { xml, missing } = fillSheetCells(decoder.decode(sheet.data), values);
  sheet.data = encoder.encode(xml);

  const workbook = files.find((f) => f.name === 'xl/workbook.xml');
  if (workbook) workbook.data = encoder.encode(enableFullCalcOnLoad(decoder.decode(workbook.data)));

  return { blob: await zip(files), missing };
}

// 生成したxlsxをダウンロードさせる
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
