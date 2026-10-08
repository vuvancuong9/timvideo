/**
 * Bố cục cột Google Sheet — logic THUẦN (không gọi API) để test được.
 *
 * Nguyên tắc: KHÔNG BAO GIỜ ghi theo vị trí cột cố định. Mỗi trường được ghi
 * vào đúng cột có tiêu đề tương ứng ở dòng tiêu đề, nên người dùng / tool khác
 * (BVP worker) chèn, xoá, đổi thứ tự cột cũng không làm dữ liệu lệch cột.
 */

export type SheetFieldKey =
  | "subId"
  | "productName"
  | "date"
  | "employee"
  | "shopeeUrl"
  | "price"
  | "commissionPercent"
  | "estimatedCommission"
  | "category"
  | "source"
  | "videoUrl"
  | "fileUrl"
  | "status"
  | "salesScore"
  | "policy"
  | "copyright"
  | "finalScore"
  | "verdict";

export type SheetField = {
  key: SheetFieldKey;
  header: string;
  /** Tên cũ / biến thể vẫn được nhận là cùng cột (so khớp sau khi chuẩn hoá). */
  aliases?: string[];
};

/** Thứ tự chuẩn A..R khi tạo sheet MỚI. Sheet đang dùng thì theo tiêu đề thật. */
export const SHEET_FIELDS: SheetField[] = [
  { key: "subId", header: "Sub ID", aliases: ["SubID", "Sub_ID"] },
  { key: "productName", header: "Tên sản phẩm", aliases: ["Ten san pham"] },
  { key: "date", header: "Ngày", aliases: ["Ngay"] },
  { key: "employee", header: "Nhân viên", aliases: ["Nhan vien"] },
  { key: "shopeeUrl", header: "Link Shopee" },
  { key: "price", header: "Giá", aliases: ["Gia"] },
  { key: "commissionPercent", header: "% Hoa hồng", aliases: ["% Hoa hong", "Hoa hồng %"] },
  { key: "estimatedCommission", header: "HH dự kiến", aliases: ["HH du kien", "Hoa hồng dự kiến"] },
  { key: "category", header: "Danh mục", aliases: ["Danh muc"] },
  { key: "source", header: "Nguồn", aliases: ["Nguon"] },
  { key: "videoUrl", header: "Link video gốc", aliases: ["Link video goc"] },
  { key: "fileUrl", header: "File video" },
  { key: "status", header: "Trạng thái", aliases: ["Trang thai"] },
  { key: "salesScore", header: "Điểm bán hàng", aliases: ["Diem ban hang"] },
  { key: "policy", header: "An toàn chính sách", aliases: ["An toan chinh sach"] },
  { key: "copyright", header: "An toàn bản quyền", aliases: ["An toan ban quyen"] },
  { key: "finalScore", header: "Điểm tổng", aliases: ["Diem tong"] },
  { key: "verdict", header: "Kết luận", aliases: ["Ket luan"] },
];

export const SHEET_HEADER: string[] = SHEET_FIELDS.map((f) => f.header);

/** Chuẩn hoá tiêu đề để so khớp: NFC, bỏ khoảng trắng thừa, không phân biệt hoa thường. */
export function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const FIELD_BY_NORMALIZED = new Map<string, SheetFieldKey>();
for (const f of SHEET_FIELDS) {
  for (const name of [f.header, ...(f.aliases ?? [])]) {
    FIELD_BY_NORMALIZED.set(normalizeHeader(name), f.key);
  }
}

export function isBlankRow(row: readonly unknown[] | undefined): boolean {
  return !row || row.every((v) => String(v ?? "").trim() === "");
}

/** Dòng tiêu đề hợp lệ = có ô "Sub ID" (để nhận ra dù cột bị dời chỗ). */
export function isHeaderRow(row: readonly unknown[] | undefined): boolean {
  return !!row && row.some((v) => FIELD_BY_NORMALIZED.get(normalizeHeader(v)) === "subId");
}

export type ColumnMap = Partial<Record<SheetFieldKey, number>>;

/**
 * Map trường → index cột (0-based) theo tiêu đề. Nếu 1 tiêu đề xuất hiện nhiều
 * lần thì lấy cột ĐẦU TIÊN (cột trùng phía sau thường là rác do copy/fill).
 */
export function buildColumnMap(headerRow: readonly unknown[]): ColumnMap {
  const map: ColumnMap = {};
  headerRow.forEach((cell, idx) => {
    const key = FIELD_BY_NORMALIZED.get(normalizeHeader(cell));
    if (key && map[key] === undefined) map[key] = idx;
  });
  return map;
}

/**
 * Các trường app cần mà dòng tiêu đề đang THIẾU → đặt tiêu đề vào các ô trống
 * NGAY SAU ô tiêu đề cuối cùng có chữ. Không bao giờ dời / ghi đè cột có sẵn.
 */
export function planMissingHeaders(
  headerRow: readonly unknown[],
  keys: readonly SheetFieldKey[] = SHEET_FIELDS.map((f) => f.key),
): { col: number; header: string; key: SheetFieldKey }[] {
  const map = buildColumnMap(headerRow);
  let lastFilled = -1;
  headerRow.forEach((v, i) => {
    if (String(v ?? "").trim() !== "") lastFilled = i;
  });
  const plan: { col: number; header: string; key: SheetFieldKey }[] = [];
  let next = lastFilled + 1;
  for (const f of SHEET_FIELDS) {
    if (keys.includes(f.key) && map[f.key] === undefined) {
      plan.push({ col: next++, header: f.header, key: f.key });
    }
  }
  return plan;
}

/** Trường app tự ghi khi thêm dòng (M "Trạng thái", N "Điểm bán hàng" do người dùng tự điền). */
export const APPEND_FIELD_KEYS: SheetFieldKey[] = [
  "subId",
  "productName",
  "date",
  "employee",
  "shopeeUrl",
  "price",
  "commissionPercent",
  "estimatedCommission",
  "category",
  "source",
  "videoUrl",
  "fileUrl",
];

/** Trường app ghi khi có điểm AI. */
export const SCORE_FIELD_KEYS: SheetFieldKey[] = ["policy", "copyright", "finalScore", "verdict"];

export type CellValue = string | number | null;

/**
 * Dựng 1 dòng theo ColumnMap: giá trị đặt đúng cột tiêu đề, ô khác để null
 * (null = không đụng tới). Trả độ dài = cột lớn nhất được ghi + 1.
 */
export function buildRow(
  values: Partial<Record<SheetFieldKey, CellValue>>,
  map: ColumnMap,
): CellValue[] {
  const cols = Object.entries(values)
    .filter(([k]) => map[k as SheetFieldKey] !== undefined)
    .map(([k, v]) => [map[k as SheetFieldKey] as number, v] as const);
  const width = cols.reduce((m, [c]) => Math.max(m, c + 1), 0);
  const row: CellValue[] = Array.from({ length: width }, () => null);
  for (const [c, v] of cols) row[c] = v;
  return row;
}

/**
 * Giá trị gửi với valueInputOption USER_ENTERED: số giữ là số; chuỗi bắt đầu
 * bằng = + - @ thêm dấu ' (Sheets coi là chữ, không hiển thị dấu ') để không
 * bị hiểu thành công thức; null → "" (giữ đúng vị trí cột trong mảng).
 */
export function toUserEnteredValue(v: CellValue): string | number {
  if (v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

/** 0 → A, 25 → Z, 26 → AA … */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type TabProps = {
  sheetId?: number | null;
  title?: string | null;
  index?: number | null;
  hidden?: boolean | null;
};

/**
 * Chọn tab ghi dữ liệu. `wanted` = gid (số sau #gid= trên URL, bền khi đổi tên
 * tab) hoặc tên tab. Không cấu hình → tab hiển thị đầu tiên. Không bao giờ
 * "đoán" sang tab khác khi tab chỉ định không tồn tại.
 */
export function pickTab<T extends TabProps>(tabs: readonly T[], wanted: string | null | undefined): T | null {
  const w = (wanted ?? "").trim();
  if (w) {
    if (/^\d+$/.test(w)) return tabs.find((t) => t.sheetId === Number(w)) ?? null;
    return tabs.find((t) => (t.title ?? "") === w) ?? null;
  }
  const visible = tabs.filter((t) => !t.hidden).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return visible[0] ?? null;
}

/** Trích tên tab an toàn cho A1 notation: 'Tên tab'!A1 (nhân đôi dấu nháy đơn). */
export function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** "dd/mm/yyyy" → số serial ngày của Google Sheets (gốc 30/12/1899). */
export function ddmmyyyyToSerial(s: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(utc)) return null;
  return Math.round(utc / 86_400_000) + 25_569;
}
