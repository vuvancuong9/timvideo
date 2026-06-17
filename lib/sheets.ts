/**
 * Ghi dữ liệu submission vào Google Sheet (mỗi video = 1 dòng).
 * Dùng cùng service account với Drive (đọc credential từ app_settings),
 * nhưng scope Sheets. GHI Sheet KHÔNG tốn quota Drive nên hoạt động tốt với
 * Gmail thường (khác với upload file Drive). Server-only.
 *
 * Mọi hàm "best-effort": nếu chưa cấu hình / chưa share sheet thì bỏ qua êm,
 * KHÔNG làm fail submit hay worker.
 */
import { google } from "googleapis";
import { getSetting } from "@/lib/secrets";
import { extractDriveCreds } from "@/lib/drive";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** Cột A..R theo thứ tự. Đổi ở đây nếu muốn thêm/bớt cột. */
export const SHEET_HEADER = [
  "Sub ID",
  "Tên sản phẩm",
  "Ngày",
  "Nhân viên",
  "Link Shopee",
  "Giá",
  "% Hoa hồng",
  "HH dự kiến",
  "Danh mục",
  "Nguồn",
  "Link video gốc",
  "File video",
  "Trạng thái",
  "Điểm bán hàng",
  "An toàn chính sách",
  "An toàn bản quyền",
  "Điểm tổng",
  "Kết luận",
];

type SheetsClient = ReturnType<typeof google.sheets>;

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

export type SubmissionSheetRow = {
  subId: string;
  productName: string;
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

function toRowArray(r: SubmissionSheetRow): (string | number)[] {
  return [
    r.subId,
    r.productName,
    r.date,
    r.employee,
    r.shopeeUrl,
    r.price,
    r.commissionPercent,
    r.estimatedCommission,
    r.category,
    r.source,
    r.videoUrl,
    r.fileUrl,
    r.status,
    "", // N Điểm bán hàng
    "", // O An toàn chính sách
    "", // P An toàn bản quyền
    "", // Q Điểm tổng
    "", // R Kết luận
  ];
}

/** sheetId (gid) của sheet đầu tiên — cần cho batchUpdate (chèn cột). */
async function firstSheetId(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.sheetId",
  });
  return meta.data.sheets?.[0]?.properties?.sheetId ?? 0;
}

/**
 * Đảm bảo hàng tiêu đề khớp SHEET_HEADER (18 cột, có "Tên sản phẩm" ở cột B).
 * - Sheet trống → ghi tiêu đề mới.
 * - Sheet đã có "Tên sản phẩm" ở B → không làm gì.
 * - Sheet theo layout CŨ (17 cột, B="Ngày") → CHÈN 1 cột trống ở B để dữ liệu
 *   cũ dịch phải giữ thẳng hàng, rồi ghi lại tiêu đề mới (tự migrate 1 lần).
 */
async function ensureHeader(
  sheets: SheetsClient,
  spreadsheetId: string,
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A1:R1",
  });
  const header = res.data.values?.[0] ?? [];
  if (header.length === 0) {
    // Sheet trống — ghi tiêu đề mới.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_HEADER] },
    });
    return;
  }
  if (header[1] === "Tên sản phẩm") return; // đã migrate

  // Layout cũ: chèn 1 cột ở vị trí B (index 1) cho TOÀN sheet rồi viết lại header.
  const sheetId = await firstSheetId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: [SHEET_HEADER] },
  });
}

/** Append 1 dòng submission. Trả {ok, error?} để caller ghi audit. */
export async function appendSubmissionRow(
  row: SubmissionSheetRow,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = await getSheetId();
    if (!sheets || !spreadsheetId) {
      return { ok: false, error: "Chưa cấu hình GOOGLE_SHEET_ID / credential" };
    }
    await ensureHeader(sheets, spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [toRowArray(row)] },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cập nhật điểm + kết luận vào dòng có Sub ID khớp (cột N..R). */
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
    const sheets = await getSheetsClient();
    const spreadsheetId = await getSheetId();
    if (!sheets || !spreadsheetId) return { ok: false, error: "not configured" };

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A:A",
    });
    const rows = res.data.values ?? [];
    let rowNum = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.[0] === subId) {
        rowNum = i + 1; // Sheets 1-based
        break;
      }
    }
    if (rowNum === -1) return { ok: false, error: "Không tìm thấy Sub ID" };

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `N${rowNum}:R${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            scores.status,
            scores.creative,
            scores.policy,
            scores.copyright,
            scores.finalScore,
            scores.verdict,
          ],
        ],
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Backfill cột "File video" (L): điền link Drive từ DB vào các dòng đang TRỐNG.
 * Đọc A2:L, GIỮ NGUYÊN L đã có, chỉ điền khi trống và DB có link cho Sub ID đó.
 * Ghi lại cả cột L 1 lần (an toàn — không đụng cột khác).
 */
export async function backfillFileLinks(
  driveLinkBySubId: Map<string, string>,
): Promise<{ ok: boolean; updated?: number; scanned?: number; error?: string }> {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = await getSheetId();
    if (!sheets || !spreadsheetId) {
      return { ok: false, error: "Chưa cấu hình GOOGLE_SHEET_ID / credential" };
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A2:L",
    });
    const rows = res.data.values ?? [];
    if (rows.length === 0) return { ok: true, updated: 0, scanned: 0 };
    let updated = 0;
    const newL = rows.map((r) => {
      const subId = (r[0] ?? "").toString().trim();
      const curL = (r[11] ?? "").toString().trim();
      if (!curL && subId) {
        const link = driveLinkBySubId.get(subId);
        if (link) {
          updated++;
          return [link];
        }
      }
      return [curL];
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `L2:L${rows.length + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newL },
    });
    return { ok: true, updated, scanned: rows.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
