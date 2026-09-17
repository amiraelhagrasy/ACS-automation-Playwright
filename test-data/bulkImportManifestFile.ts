import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

//edits the real downloadable template in place (copied into the repo below) instead of building a workbook from
//scratch - confirmed live: a from-scratch workbook (aoa_to_sheet, "Sheet1", text-typed dates/numbers) got
//rejected with a string of different, inconsistent validation errors across many attempts. Reading the actual
//file and inspecting its cells directly (via node + the xlsx package) revealed what a plain CSV/text copy of it
//could never show: the sheet is really named "Upload_Import" (there's a second "Data" sheet with dropdown
//reference values), and DOCREFNO/BILL_NO/all four date columns are real numeric/date-typed cells, not text -
//e.g. a date cell's underlying value is the Excel serial number 45862, displayed as "7/24/25" by its number
//format, not the literal string "24/07/2025" a flattened CSV paste made it look like:
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'IMPORT_EXCEL_TEMPLATE.xlsx');
const SHEET_NAME = 'Upload_Import';
const FIRST_DATA_ROW = 4; // 1-indexed: row1=header, row2=legend, row3=spec, row4 onward=data

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function getTodayDateParts() {
  const today = new Date();
  return {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };
}

//Excel's date serial: whole days since 1899-12-30 (its epoch, including the historical leap-year quirk) - the
//standard conversion, matches the 45862 == 24-Jul-2025 serial confirmed live in the template's own example row:
function toExcelSerial(day: number, month: number, year: number): number {
  const epoch = Date.UTC(1899, 11, 30);
  const target = Date.UTC(year, month - 1, day);
  return Math.round((target - epoch) / (24 * 60 * 60 * 1000));
}

//BILL_NO's date-code prefix: full 4-digit year + 2-digit day + month WITHOUT a leading zero, confirmed live
//against the real template (e.g. today 16-09-2026 -> "2026" + "16" + "9" -> "2026169"), then a 4-digit sequence:
function buildBillNo(day: number, month: number, year: number, seq: number): number {
  return Number(`${year}${pad2(day)}${month}${pad4(seq)}`);
}

export type BulkImportManifestFile = {
  filePath: string;
  billNos: number[];
  docRefNo: number;
};

export function generateBulkImportManifestXlsx(billCount = 999): BulkImportManifestFile {
  const { day, month, year } = getTodayDateParts();
  const dateSerial = toExcelSerial(day, month, year);

  //DOCREFNO must be unique - confirmed live: reusing the same value on a second upload the same day was
  //rejected with "معلومات المانيفست موجودة مسبقاً في النظام ومربوطة بالرقم المرجعي التالي" (this manifest info
  //already exists, linked to reference number <N>). Append a 6-digit sequence for uniqueness, matching the
  //template's own example (8-digit date + 6-digit sequence = 14 digits total, e.g. "20250724000001") - confirmed
  //live: going to 16 digits (8+8) pushed the cell past Excel's own General-format threshold and displayed in
  //scientific notation ("2.02609E+15") when opened, unlike the template's 14-digit example:
  const docRefNo = Number(`${year}${pad2(month)}${pad2(day)}${Date.now().toString().slice(-6)}`);

  //the "already exists" duplicate check turned out to key off flight identity (carrier + flight number + port +
  //date), not DOCREFNO - confirmed live: a fixed "SV110" got rejected on a second same-day run pointing at the
  //manifest from the run just before. Same defensive pattern already used for flightNumber in
  //newImportManifestData.ts:
  const flightNo = `SV${Date.now().toString().slice(-5)}`;

  const workbook = XLSX.readFile(TEMPLATE_PATH, { cellDates: false });
  const worksheet = workbook.Sheets[SHEET_NAME];

  const billNos: number[] = [];

  //date number format copied from the template's own example date cell, so newly-written dates render the same
  //way the template's author set up rather than whatever default SheetJS would otherwise pick:
  const dateFormat = worksheet['G' + FIRST_DATA_ROW]?.z;

  //column letters for all 47 columns, in header order (A..Z then AA..AU):
  const A_TO_Z = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const COLUMNS = [...A_TO_Z, ...A_TO_Z.map((c) => 'A' + c)].slice(0, 47);

  const setCell = (col: string, row: number, value: string | number | undefined, isDate = false): void => {
    const addr = `${col}${row}`;
    if (value === undefined || value === '') {
      delete worksheet[addr];
      return;
    }
    if (typeof value === 'number') {
      worksheet[addr] = isDate ? { t: 'n', v: value, z: dateFormat } : { t: 'n', v: value };
    } else {
      worksheet[addr] = { t: 's', v: value };
    }
  };

  for (let i = 1; i <= billCount; i++) {
    const row = FIRST_DATA_ROW + i - 1;
    const billNo = buildBillNo(day, month, year, i);
    billNos.push(billNo);

    //blank on continuation rows, matching the pattern shown in the template's own convention (only the first
    //bill row of a manifest carries the manifest-level fields):
    const isFirstRow = i === 1;

    const values: (string | number | undefined)[] = [
      isFirstRow ? docRefNo : undefined, // DOCREFNO
      isFirstRow ? 'SARUH' : undefined, // PORT_CODE
      isFirstRow ? 'SV' : undefined, // CARRIER_CODE
      isFirstRow ? flightNo : undefined, // FLIGHT_NO
      isFirstRow ? 'SG' : undefined, // CTRY_LOADING
      isFirstRow ? 'SIN' : undefined, // PORT_LOADING
      isFirstRow ? dateSerial : undefined, // FLIGHT_DEPART_DATE
      isFirstRow ? dateSerial : undefined, // FLIGHT_ARRIVAL_DATE
      isFirstRow ? dateSerial : undefined, // UNLOAD_DATE
      isFirstRow ? billCount : undefined, // TOTAL_ARRIVED_BILLS
      isFirstRow ? 2 : undefined, // SHIPPING_AGENT_TYPE
      billNo, // BILL_NO
      dateSerial, // BILL_DATE
      'New', // MASTER_BILL_MODE
      1, // BILL_TYPE
      1, // BILL_CATEGORY
      10, // TOTAL_WGT
      10, // TOTAL_QTY
      'SA', // FINAL_CTRY
      'RUH', // FINAL_PORT
      4, // FINAL_PORT_TYPE
      undefined, // IMP_NO (optional, blank in the template's own example too)
      'اسم المالك', // OWN_ARB_NAME
      'Owner Name', // OWN_ENG_NAME
      511111111, // OWN_PH_NO
      1234, // OWN_FAX
      'abcd', // IMP_NAME
      12345, // IMP_PH_NO
      12345, // IMP_FAX
      1234, // OWN_POB
      1234, // OWN_ZIP
      'abc@def.com', // OWN_EMAIL
      'CC', // CALC_METHOD
      'SAR', // CURR_CODE
      50, // TRANS_VAL
      1, // PAY_METHOD
      //confirmed live: 0 (matching the template's own example row exactly) was rejected as invalid in this column
      //- a mandatory decimal field apparently doesn't accept zero. Use a plausible non-zero value instead:
      50, // BILL_VALUE
      'SAR', // BILL_CURR_CODE
      1, // MANIFEST_TYPE
      'DC', // ITEM_PKG_TYPE
      10, // ITM_WGT
      10, // ITM_QTY
      'ENG', // ITM_ENG_DESC
      'اختبار بيانات اكسل', // ITM_ARB_DESC
      'اكسل', // ITM_MARKS
      10, // WARE_CODE
      10, // WARE_QTY
    ];

    const dateColumns = new Set(['G', 'H', 'I', 'M']); // FLIGHT_DEPART_DATE, FLIGHT_ARRIVAL_DATE, UNLOAD_DATE, BILL_DATE

    COLUMNS.forEach((col, idx) => {
      setCell(col, row, values[idx], dateColumns.has(col));
    });
  }

  //unique filename per call - confirmed live: a fixed per-day name caused "EBUSY: resource busy or locked" when
  //a retry ran again the same day while something (the browser's own file-upload handling, antivirus, etc.)
  //still held the previous attempt's file open:
  const outDir = path.join(os.tmpdir(), 'fasah-bulk-import');
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `import-manifest-${year}${pad2(month)}${pad2(day)}-${billCount}-${Date.now()}.xlsx`);
  XLSX.writeFile(workbook, filePath);

  return { filePath, billNos, docRefNo };
}
