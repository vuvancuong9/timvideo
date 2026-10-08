/**
 * Ghi dữ liệu submission vào Google Sheet (mỗi video = 1 dòng).
 * Dùng cùng service account với Drive (đọc credential từ app_settings),
 * nhưng scope Sheets. GHI Sheet KHÔNG tốn quota Drive nên hoạt động tốt với
 * Gmail thường (khác với upload file Drive). Server-only.
 *
 * Mọi hàm "best-effort": nếu chưa cấu hình / chưa share sheet thì bỏ qua êm,
 * KHÔNG làm fail submit hay worker.
 *
 * Sheet có NHIỀU bên cùng ghi (app này, BVP worker, người dùng) nên:
 * - Mọi ô được ghi theo TÊN tiêu đề cột (lib/sheet-layout), không theo vị trí.
 * - Không bao giờ tự chèn / xoá / dời cột hay dòng.
 * - Thêm dòng bằng AppendCellsRequest (sau dòng cuối có dữ liệu của tab).
 *   values.append dò "bảng" từ ô neo nên gặp dòng trống / dòng tiêu đề lạc
 *   là ghi lọt vào giữa sheet.
 * - Luôn chỉ định tab (GOOGLE_SHEET_TAB: gid hoặc tên; trống = tab đầu tiên).
 */
import { google, type sheets_v4 } from "googleapis";
import { getSetting } from "@/lib/secrets";
import { extractDriveCreds } from "@/lib/drive";
import {
  APPEND_FIELD_KEYS,
  SCORE_FIELD_KEYS,
  SHEET_HEADER,
  buildColumnMap,
  buildRow,
  columnLetter,
  ddmmyyyyToSerial,
  isBlankRow,
  isHeaderRow,
  pickTab,
  planMissingHeaders,
  quoteSheetTitle,
  type CellValue,
  type ColumnMap,
  type SheetFieldKey,
} from "@/lib/sheet-layout";

export { SHEET_HEADER };

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/** Dòng tiêu đề được tìm trong N dòng đầu (lỡ có người chèn dòng phía trên). */
const HEADER_SCAN_ROWS = 5;
const TAB_CACHE_TTL_MS = 5 * 60_000;
/** Google giới hạn số range mỗi values.batchUpdate; chia nhỏ cho chắc. */
const BATCH_CHUNK = 500;

type SheetsClient = sheets_v4.Sheets;

type Target = {
  sheets: SheetsClient;
  spreadsheetId: string;
  sheetId: number;
  title: string;
  /** Tên tab đã quote cho A1 notation, vd 'DATA'. */
  q: string;
};

type Header = { row: number; map: ColumnMap };

async function getSheetsClient(): Promise<SheetsClient | null> {
  const rawEmail = await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL");
  const rawKey = await getSetting("GOOGLE_DRIVE_PRIVATE_KEY");
  if (!rawKey) return null;
  const { email, privateKey } = extractDriveCreds(rawKey, rawEmail);
  if (!email || !privateKey.includes("PRIVATE KEY")) return null;
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });
  return google.sheets({ version: "v4", auth });
}

export async function getSheetId(): Promise<string | null> {
  const id = await getSetting("GOOGLE_SHEET_ID");
  return id && id.trim() ? id.trim() : null;
}

let tabCache: { spreadsheetId: string; at: number; tabs: sheets_v4.Schema$SheetProperties[] } | null =
  null;

async function listTabs(
  sheets: SheetsClient,
  spreadsheetId: string,
  fresh = false,
): Promise<sheets_v4.Schema$SheetProperties[]> {
  if (
    !fresh &&
    tabCache &&
    tabCache.spreadsheetId === spreadsheetId &&
    Date.now() - tabCache.at < TAB_CACHE_TTL_MS
  ) {
    return tabCache.tabs;
  }
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,index,hidden)",
  });
  const tabs = (meta.data.sheets ?? [])
    .map((s) => s.properties)
    .filter((p): p is sheets_v4.Schema$SheetProperties => !!p);
  tabCache = { spreadsheetId, at: Date.now(), tabs };
  return tabs;
}

async function resolveTarget(): Promise<Target | null> {
  const sheets = await getSheetsClient();
  const spreadsheetId = await getSheetId();
  if (!sheets || !spreadsheetId) return null;
  const wanted = (await getSetting("GOOGLE_SHEET_TAB")) ?? null;
  let tab = pickTab(await listTabs(sheets, spreadsheetId), wanted);
  if (!tab) tab = pickTab(await listTabs(sheets, spreadsheetId, true), wanted);
  if (!tab) {
    throw new Error(
      wanted
        ? `Không tìm thấy tab "${wanted}" (cấu hình GOOGLE_SHEET_TAB) trong Google Sheet.`
        : "Google Sheet không có tab nào.",
    );
  }
  const title = tab.title ?? "";
  return { sheets, spreadsheetId, sheetId: tab.sheetId ?? 0, title, q: quoteSheetTitle(title) };
}

async function tabLooksEmpty(t: Target): Promise<boolean> {
  const res = await t.sheets.spreadsheets.values.get({
    spreadsheetId: t.spreadsheetId,
    range: `${t.q}!A1:AD1000`,
  });
  return (res.data.values ?? []).every((r) => isBlankRow(r));
}

/**
 * Tìm dòng tiêu đề + map cột. Tab trống hoàn toàn → ghi tiêu đề chuẩn.
 * Thiếu tiêu đề cho trường cần ghi → thêm tiêu đề vào ô trống phía SAU cột
 * cuối (không đụng cột có sẵn). Không tìm thấy tiêu đề → ném lỗi, KHÔNG ghi.
 */
async function loadHeader(t: Target, need: readonly SheetFieldKey[]): Promise<Header> {
  const res = await t.sheets.spreadsheets.values.get({
    spreadsheetId: t.spreadsheetId,
    range: `${t.q}!1:${HEADER_SCAN_ROWS}`,
  });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex((r) => isHeaderRow(r));

  if (idx === -1) {
    if (rows.every((r) => isBlankRow(r)) && (await tabLooksEmpty(t))) {
      await t.sheets.spreadsheets.values.update({
        spreadsheetId: t.spreadsheetId,
        range: `${t.q}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [SHEET_HEADER] },
      });
      return { row: 1, map: buildColumnMap(SHEET_HEADER) };
    }
    throw new Error(
      `Tab "${t.title}": không thấy dòng tiêu đề (ô "Sub ID") trong ${HEADER_SCAN_ROWS} dòng đầu nên KHÔNG ghi (tránh lệch cột). Sửa lại dòng tiêu đề rồi bấm "Ghi bù dòng thiếu".`,
    );
  }

  const header = rows[idx];
  const map = buildColumnMap(header);
  const plan = planMissingHeaders(header, need);
  if (plan.length > 0) {
    await t.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: t.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: plan.map((p) => ({
          range: `${t.q}!${columnLetter(p.col)}${idx + 1}`,
          values: [[p.header]],
        })),
      },
    });
    for (const p of plan) map[p.key] = p.col;
  }
  return { row: idx + 1, map };
}

/** Đọc 1 cột (theo index) từ dưới dòng tiêu đề tới hết. */
async function readColumn(t: Target, header: Header, col: number): Promise<string[]> {
  const L = columnLetter(col);
  const res = await t.sheets.spreadsheets.values.get({
    spreadsheetId: t.spreadsheetId,
    range: `${t.q}!${L}${header.row + 1}:${L}`,
  });
  return (res.data.values ?? []).map((r) => String(r?.[0] ?? "").trim());
}

async function writeCells(
  t: Target,
  cells: { range: string; value: string | number }[],
): Promise<void> {
  for (let i = 0; i < cells.length; i += BATCH_CHUNK) {
    await t.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: t.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: cells.slice(i, i + BATCH_CHUNK).map((c) => ({ range: c.range, values: [[c.value]] })),
      },
    });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type SubmissionSheetRow = {
  subId: string;
  productName: string;
  /** dd/mm/yyyy (giờ VN). */
  date: string;
  employee: string;
  shopeeUrl: string;
  price: number;
  commissionPercent: number;
  estimatedCommission: number;
  category: string;
  source: string;
  videoUrl: string;
  fileUrl: string;
  status: string;
};

function toFieldValues(r: SubmissionSheetRow): Partial<Record<SheetFieldKey, CellValue>> {
  // "Trạng thái" / "Điểm bán hàng" do người dùng tự điền → app không ghi.
  return {
    subId: r.subId,
    productName: r.productName,
    date: r.date,
    employee: r.employee,
    shopeeUrl: r.shopeeUrl,
    price: r.price,
    commissionPercent: r.commissionPercent,
    estimatedCommission: r.estimatedCommission,
    category: r.category,
    source: r.source,
    videoUrl: r.videoUrl,
    fileUrl: r.fileUrl,
  };
}

const NUMBER_FORMATS: Partial<Record<SheetFieldKey, sheets_v4.Schema$NumberFormat>> = {
  date: { type: "DATE", pattern: "dd/mm/yyyy" },
  price: { type: "NUMBER", pattern: "#,##0" },
  estimatedCommission: { type: "NUMBER", pattern: "#,##0" },
};

/**
 * Giá trị có kiểu tường minh (không để Sheets tự đoán theo locale): ngày là
 * serial + định dạng dd/mm/yyyy, số là số, còn lại là chuỗi (chuỗi bắt đầu
 * bằng "=" / "+" không bị hiểu thành công thức).
 */
function toCellData(key: SheetFieldKey | undefined, v: CellValue): sheets_v4.Schema$CellData {
  if (v === null || v === "") return {};
  const fmt = key ? NUMBER_FORMATS[key] : undefined;
  if (key === "date" && typeof v === "string") {
    const serial = ddmmyyyyToSerial(v);
    if (serial !== null) {
      return { userEnteredValue: { numberValue: serial }, userEnteredFormat: { numberFormat: fmt } };
    }
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return {
      userEnteredValue: { numberValue: v },
      ...(fmt ? { userEnteredFormat: { numberFormat: fmt } } : {}),
    };
  }
  return { userEnteredValue: { stringValue: String(v) } };
}

async function appendRows(rows: SubmissionSheetRow[]): Promise<void> {
  const t = await resolveTarget();
  if (!t) throw new Error("Chưa cấu hình GOOGLE_SHEET_ID / credential");
  const header = await loadHeader(t, APPEND_FIELD_KEYS);
  if (header.map.subId === undefined) throw new Error('Dòng tiêu đề thiếu cột "Sub ID"');
  const keyAt = new Map<number, SheetFieldKey>();
  for (const [k, c] of Object.entries(header.map)) keyAt.set(c as number, k as SheetFieldKey);

  await t.sheets.spreadsheets.batchUpdate({
    spreadsheetId: t.spreadsheetId,
    requestBody: {
      requests: [
        {
          appendCells: {
            sheetId: t.sheetId,
            rows: rows.map((r) => ({
              values: buildRow(toFieldValues(r), header.map).map((v, c) => toCellData(keyAt.get(c), v)),
            })),
            fields: "userEnteredValue,userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}

/** Append 1 dòng submission. Trả {ok, error?} để caller ghi audit. */
export async function appendSubmissionRow(
  row: SubmissionSheetRow,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await appendRows([row]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Append NHIỀU dòng submission 1 lần (ghi bù dòng còn thiếu). */
export async function appendSubmissionRows(
  rows: SubmissionSheetRow[],
): Promise<{ ok: boolean; appended?: number; error?: string }> {
  try {
    if (rows.length === 0) return { ok: true, appended: 0 };
    for (let i = 0; i < rows.length; i += BATCH_CHUNK) {
      await appendRows(rows.slice(i, i + BATCH_CHUNK));
    }
    return { ok: true, appended: rows.length };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/**
 * Cập nhật điểm AI + kết luận vào dòng có Sub ID khớp, đúng các cột tiêu đề
 * "An toàn chính sách", "An toàn bản quyền", "Điểm tổng", "Kết luận".
 * KHÔNG ghi "Trạng thái" / "Điểm bán hàng" — người dùng tự điền.
 */
export async function updateSubmissionScores(
  subId: string,
  scores: {
    status: string;
    creative: number;
    policy: number;
    copyright: number;
    finalScore: number;
    verdict: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = await resolveTarget();
    if (!t) return { ok: false, error: "not configured" };
    const header = await loadHeader(t, SCORE_FIELD_KEYS);
    if (header.map.subId === undefined) return { ok: false, error: 'Thiếu cột "Sub ID"' };

    const ids = await readColumn(t, header, header.map.subId);
    const i = ids.lastIndexOf(subId.trim());
    if (i === -1) return { ok: false, error: "Không tìm thấy Sub ID" };
    const rowNum = header.row + 1 + i;

    const values: [SheetFieldKey, string | number][] = [
      ["policy", scores.policy],
      ["copyright", scores.copyright],
      ["finalScore", scores.finalScore],
      ["verdict", scores.verdict],
    ];
    await writeCells(
      t,
      values
        .filter(([k]) => header.map[k] !== undefined)
        .map(([k, v]) => ({ range: `${t.q}!${columnLetter(header.map[k] as number)}${rowNum}`, value: v })),
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/**
 * Backfill cột "File video": điền link Drive từ DB vào các ô đang TRỐNG,
 * GIỮ NGUYÊN ô đã có. Chỉ ghi đúng những ô cần điền (không ghi đè cả cột).
 */
export async function backfillFileLinks(
  driveLinkBySubId: Map<string, string>,
): Promise<{ ok: boolean; updated?: number; scanned?: number; error?: string }> {
  try {
    const t = await resolveTarget();
    if (!t) return { ok: false, error: "Chưa cấu hình GOOGLE_SHEET_ID / credential" };
    const header = await loadHeader(t, ["fileUrl"]);
    const subCol = header.map.subId;
    const fileCol = header.map.fileUrl;
    if (subCol === undefined || fileCol === undefined) {
      return { ok: false, error: 'Thiếu cột "Sub ID" hoặc "File video"' };
    }
    const [ids, files] = await Promise.all([
      readColumn(t, header, subCol),
      readColumn(t, header, fileCol),
    ]);
    const L = columnLetter(fileCol);
    const cells: { range: string; value: string }[] = [];
    ids.forEach((subId, i) => {
      if (!subId || files[i]) return;
      const link = driveLinkBySubId.get(subId);
      if (link) cells.push({ range: `${t.q}!${L}${header.row + 1 + i}`, value: link });
    });
    await writeCells(t, cells);
    return { ok: true, updated: cells.length, scanned: ids.length };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Đọc tập Sub ID đang có trong Sheet. null nếu chưa cấu hình. */
export async function listSheetSubIds(): Promise<Set<string> | null> {
  const t = await resolveTarget();
  if (!t) return null;
  const header = await loadHeader(t, []);
  if (header.map.subId === undefined) throw new Error('Thiếu cột "Sub ID"');
  const set = new Set<string>();
  for (const v of await readColumn(t, header, header.map.subId)) if (v) set.add(v);
  return set;
}
