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
  duplicateLabels,
  findLabel,
  isBlankRow,
  isHeaderRow,
  missingHeaders,
  pickTab,
  quoteSheetTitle,
  toUserEnteredValue,
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

type Header = { row: number; map: ColumnMap; cells: string[] };

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
 * Không tìm thấy tiêu đề / thiếu cột cần ghi / nhãn bị trùng → ném lỗi,
 * KHÔNG ghi (thà thiếu dòng rồi ghi bù còn hơn ghi lệch cột).
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
      return { row: 1, map: buildColumnMap(SHEET_HEADER), cells: [...SHEET_HEADER] };
    }
    throw new Error(
      `Tab "${t.title}": không thấy dòng tiêu đề (ô "Sub ID") trong ${HEADER_SCAN_ROWS} dòng đầu nên KHÔNG ghi (tránh lệch cột). Sửa lại dòng tiêu đề rồi bấm "Ghi bù dòng thiếu".`,
    );
  }

  const cells = rows[idx].map((v) => String(v ?? ""));
  const dup = duplicateLabels(cells);
  if (dup.length > 0) {
    throw new Error(
      `Tab "${t.title}": dòng tiêu đề có cột trùng tên (${dup.join(", ")}) nên KHÔNG ghi (không biết cột nào đúng). Xoá/đổi tên cột trùng rồi bấm "Ghi bù dòng thiếu".`,
    );
  }
  const missing = missingHeaders(cells, need);
  if (missing.length > 0) {
    throw new Error(
      `Tab "${t.title}": dòng tiêu đề thiếu cột ${missing.map((m) => `"${m}"`).join(", ")} nên KHÔNG ghi. Thêm lại đúng tên cột rồi bấm "Ghi bù dòng thiếu".`,
    );
  }
  return { row: idx + 1, map: buildColumnMap(cells), cells };
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

/**
 * Chèn dòng mới bằng values.append + INSERT_ROWS: Google tự chèn hàng mới nên
 * nhiều lượt gửi cùng giây không ghi đè nhau (AppendCellsRequest thì có — 2
 * request đồng thời ghi chung 1 dòng trống). values.append dò "bảng" liền
 * mạch từ A1 nên yêu cầu tiêu đề ở đúng dòng 1; ngày gửi dạng dd/mm/yyyy
 * (USER_ENTERED theo locale vi_VN của sheet).
 * Trả về vùng đã ghi (vd 'DATA'!A47690:L47690) để audit biết dòng nào.
 */
async function appendRows(rows: SubmissionSheetRow[]): Promise<string | null> {
  const t = await resolveTarget();
  if (!t) throw new Error("Chưa cấu hình GOOGLE_SHEET_ID / credential");
  const header = await loadHeader(t, APPEND_FIELD_KEYS);
  if (header.map.subId !== 0) throw new Error('Cột "Sub ID" phải là cột A của dòng tiêu đề');
  if (header.row !== 1) {
    throw new Error(
      `Tab "${t.title}": dòng tiêu đề đang ở dòng ${header.row}, phải ở dòng 1 — KHÔNG ghi để tránh chèn sai chỗ. Xoá các dòng phía trên tiêu đề rồi bấm "Ghi bù dòng thiếu".`,
    );
  }
  const values = rows.map((r) => buildRow(toFieldValues(r), header.map).map(toUserEnteredValue));
  const subIds = rows.map((r) => r.subId.trim());

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await t.sheets.spreadsheets.values.append({
        spreadsheetId: t.spreadsheetId,
        range: `${t.q}!A1`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
      return res.data.updates?.updatedRange ?? null;
    } catch (err) {
      if (!isTransient(err) || attempt >= APPEND_ATTEMPTS) throw err;
      await sleep(1000 * 3 ** (attempt - 1));
      // Lỗi 5xx / mất kết nối vẫn có thể đã ghi xong phía Google: kiểm tra
      // trước khi gửi lại để không sinh dòng trùng.
      const present = new Set(await readColumn(t, header, 0));
      const found = subIds.filter((s) => present.has(s)).length;
      if (found === subIds.length) return null;
      if (found > 0) throw new Error(`Ghi dở dang (${found}/${subIds.length} dòng đã lên) — kiểm tra lại sheet`);
    }
  }
}

const APPEND_ATTEMPTS = 4;

function isTransient(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const status = Number(e?.response?.status ?? e?.status ?? e?.code);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED", "EPIPE"].includes(String(e?.code));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Append 1 dòng submission. Trả {ok, range?, error?} để caller ghi audit. */
export async function appendSubmissionRow(
  row: SubmissionSheetRow,
): Promise<{ ok: boolean; range?: string; error?: string }> {
  try {
    const range = await appendRows([row]);
    return { ok: true, range: range ?? undefined };
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
    const i = ids.indexOf(subId.trim());
    if (i === -1) return { ok: false, error: "Không tìm thấy Sub ID" };
    if (ids.lastIndexOf(subId.trim()) !== i) {
      return { ok: false, error: "Sub ID xuất hiện nhiều dòng — không ghi điểm để tránh ghi nhầm dòng" };
    }
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
 * Bỏ qua dòng đã có BVP_ROW_ID: BVP đối chiếu "File video" của dòng đó, đổi
 * là nó khoá ghi.
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
    const bvpCol = findLabel(header.cells, "BVP_ROW_ID");
    const [ids, files, bvpIds] = await Promise.all([
      readColumn(t, header, subCol),
      readColumn(t, header, fileCol),
      bvpCol >= 0 ? readColumn(t, header, bvpCol) : Promise.resolve([] as string[]),
    ]);
    const L = columnLetter(fileCol);
    const cells: { range: string; value: string }[] = [];
    ids.forEach((subId, i) => {
      if (!subId || files[i] || bvpIds[i]) return;
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
