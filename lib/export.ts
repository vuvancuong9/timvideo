/** Tạo nội dung CSV (kèm BOM để Excel đọc đúng UTF-8). */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  return `${lines.join("\r\n")}`;
}

/** Tạo file XLSX (exceljs nạp động để không phình bundle các route khác). */
export async function toXlsx(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) sheet.addRow(r);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
