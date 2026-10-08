import { describe, expect, it } from "vitest";
import {
  APPEND_FIELD_KEYS,
  BVP_LABELS,
  SCORE_FIELD_KEYS,
  SHEET_HEADER,
  buildColumnMap,
  buildRow,
  columnLetter,
  ddmmyyyyToSerial,
  duplicateLabels,
  findLabel,
  isBlankRow,
  isHeaderRow,
  missingHeaders,
  normalizeHeader,
  pickTab,
  quoteSheetTitle,
  toUserEnteredValue,
} from "@/lib/sheet-layout";

describe("normalizeHeader", () => {
  it("bỏ khoảng trắng thừa, không phân biệt hoa thường", () => {
    expect(normalizeHeader("  Tên   sản phẩm ")).toBe("tên sản phẩm");
    expect(normalizeHeader("SUB ID")).toBe("sub id");
  });
  it("NFD (gõ bằng bộ gõ tổ hợp) vẫn khớp NFC", () => {
    expect(normalizeHeader("Tên sản phẩm".normalize("NFD"))).toBe(normalizeHeader("Tên sản phẩm"));
  });
});

describe("buildColumnMap", () => {
  it("header chuẩn → A..R", () => {
    const m = buildColumnMap(SHEET_HEADER);
    expect(m.subId).toBe(0);
    expect(m.productName).toBe(1);
    expect(m.fileUrl).toBe(11);
    expect(m.verdict).toBe(17);
  });

  it("cột bị chèn thêm / đổi chỗ → vẫn ghi đúng cột tiêu đề", () => {
    const header = ["Sub ID", "", "Tên sản phẩm", "Ngày", "BVP_ROW_ID", "Nhân viên", "Link Shopee"];
    const m = buildColumnMap(header);
    expect(m.subId).toBe(0);
    expect(m.productName).toBe(2);
    expect(m.date).toBe(3);
    expect(m.employee).toBe(5);
    expect(m.shopeeUrl).toBe(6);
  });

  it("tiêu đề trùng → lấy cột đầu tiên", () => {
    const m = buildColumnMap(["Sub ID", "Kết luận", "Kết luận", "Kết luận"]);
    expect(m.verdict).toBe(1);
  });

  it("nhận alias không dấu", () => {
    expect(buildColumnMap(["Sub ID", "Ten san pham"]).productName).toBe(1);
  });
});

describe("isHeaderRow / isBlankRow", () => {
  it("dòng dữ liệu không phải header", () => {
    expect(isHeaderRow(["0610baybem1000033", "", "Bún gạo lứt"])).toBe(false);
    expect(isHeaderRow(SHEET_HEADER)).toBe(true);
    expect(isHeaderRow(["", "Sub ID"])).toBe(true);
  });
  it("ô chỉ có khoảng trắng = trống", () => {
    expect(isBlankRow(["", " ", "    "])).toBe(true);
    expect(isBlankRow(undefined)).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});

/** Dòng 1 tab DATA sau khi sửa: A..R của app, S/T/U của BVP. */
const LIVE_HEADER = [...SHEET_HEADER, "Trạng thái Video", "Link driver video", "BVP_ROW_ID"];

describe("missingHeaders", () => {
  it("sheet đủ cột (kể cả cột BVP) → không thiếu gì", () => {
    expect(missingHeaders(LIVE_HEADER, APPEND_FIELD_KEYS)).toEqual([]);
    expect(missingHeaders(LIVE_HEADER, SCORE_FIELD_KEYS)).toEqual([]);
  });
  it("thiếu cột cần ghi → liệt kê đúng tên để báo lỗi", () => {
    const header = LIVE_HEADER.filter((h) => h !== "Link Shopee");
    expect(missingHeaders(header, APPEND_FIELD_KEYS)).toEqual(["Link Shopee"]);
    expect(missingHeaders(header, SCORE_FIELD_KEYS)).toEqual([]);
  });
  it("cột người dùng tự quản (Trạng thái, Điểm bán hàng) không bắt buộc", () => {
    const header = SHEET_HEADER.filter((h) => h !== "Trạng thái" && h !== "Điểm bán hàng");
    expect(missingHeaders(header, APPEND_FIELD_KEYS)).toEqual([]);
    expect(missingHeaders(header, SCORE_FIELD_KEYS)).toEqual([]);
  });
});

describe("duplicateLabels", () => {
  it("header chuẩn sau khi sửa → không trùng", () => {
    expect(duplicateLabels(LIVE_HEADER)).toEqual([]);
  });
  it("header cũ với 3 ô 'Kết luận' → báo trùng", () => {
    expect(duplicateLabels([...SHEET_HEADER, "Kết luận", "Kết luận", "BVP_ROW_ID"])).toEqual(["Kết luận"]);
  });
  it("alias không dấu cùng trường cũng tính là trùng; nhãn BVP trùng cũng báo", () => {
    expect(duplicateLabels(["Sub ID", "Ngày", "Ngay"])).toEqual(["Ngày"]);
    expect(duplicateLabels(["Sub ID", "BVP_ROW_ID", "bvp_row_id "])).toEqual(["BVP_ROW_ID"]);
  });
  it("cột lạ do người dùng thêm (trùng nhau) không chặn ghi", () => {
    expect(duplicateLabels([...LIVE_HEADER, "Ghi chú", "Ghi chú"])).toEqual([]);
  });
});

describe("findLabel", () => {
  it("tìm cột BVP theo tên đã chuẩn hoá", () => {
    expect(BVP_LABELS.every((l) => findLabel(LIVE_HEADER, l) >= 18)).toBe(true);
    expect(findLabel(LIVE_HEADER, "BVP_ROW_ID")).toBe(20);
    expect(findLabel(LIVE_HEADER, "trạng thái video")).toBe(18);
    expect(findLabel(SHEET_HEADER, "BVP_ROW_ID")).toBe(-1);
  });
});

describe("buildRow", () => {
  it("đặt giá trị đúng cột, ô khác null (không đụng tới)", () => {
    const m = buildColumnMap(["Sub ID", "BVP_ROW_ID", "Tên sản phẩm", "Giá"]);
    const row = buildRow({ subId: "0810abc001", productName: "SP", price: 63000 }, m);
    expect(row).toEqual(["0810abc001", null, "SP", 63000]);
  });
  it("trường không có cột tiêu đề thì bỏ qua", () => {
    const m = buildColumnMap(["Sub ID"]);
    expect(buildRow({ subId: "x", verdict: "Nên lấy" }, m)).toEqual(["x"]);
  });
});

describe("pickTab", () => {
  const tabs = [
    { sheetId: 594399014, title: "WritebackTest", index: 2 },
    { sheetId: 1664840937, title: "Trang tính2", index: 1 },
    { sheetId: 0, title: "DATA", index: 0 },
  ];
  it("không cấu hình → tab hiển thị đầu tiên", () => {
    expect(pickTab(tabs, null)?.title).toBe("DATA");
    expect(pickTab([{ ...tabs[2], hidden: true }, tabs[1]], "")?.title).toBe("Trang tính2");
  });
  it("theo gid (bền khi đổi tên / đổi thứ tự tab)", () => {
    expect(pickTab(tabs, "0")?.title).toBe("DATA");
    expect(pickTab([{ ...tabs[2], title: "DATA cũ", index: 5 }, tabs[1]], "0")?.title).toBe("DATA cũ");
  });
  it("theo tên; không có → null (không đoán sang tab khác)", () => {
    expect(pickTab(tabs, "WritebackTest")?.sheetId).toBe(594399014);
    expect(pickTab(tabs, "Không có")).toBeNull();
    expect(pickTab(tabs, "123")).toBeNull();
  });
});

describe("toUserEnteredValue", () => {
  it("chuỗi giống công thức → thêm dấu ' để giữ là chữ", () => {
    expect(toUserEnteredValue("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(toUserEnteredValue("-50% giảm giá")).toBe("'-50% giảm giá");
    expect(toUserEnteredValue("+84 912")).toBe("'+84 912");
    expect(toUserEnteredValue("@shop")).toBe("'@shop");
  });
  it("chuỗi thường / ngày / link giữ nguyên, số giữ là số, null → rỗng", () => {
    expect(toUserEnteredValue("08/10/2026")).toBe("08/10/2026");
    expect(toUserEnteredValue("https://shopee.vn/x")).toBe("https://shopee.vn/x");
    expect(toUserEnteredValue(63000)).toBe(63000);
    expect(toUserEnteredValue(12.5)).toBe(12.5);
    expect(toUserEnteredValue(Number.NaN)).toBe("");
    expect(toUserEnteredValue(null)).toBe("");
  });
  it("dòng dựng theo map giữ đúng vị trí cột khi có cột BVP xen giữa", () => {
    const m = buildColumnMap(["Sub ID", "Tên sản phẩm", "BVP_ROW_ID", "Giá"]);
    expect(buildRow({ subId: "a", productName: "=x", price: 5 }, m).map(toUserEnteredValue)).toEqual(["a", "'=x", "", 5]);
  });
});

describe("helpers", () => {
  it("columnLetter", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(17)).toBe("R");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(29)).toBe("AD");
  });
  it("quoteSheetTitle nhân đôi nháy đơn", () => {
    expect(quoteSheetTitle("DATA")).toBe("'DATA'");
    expect(quoteSheetTitle("Bob's")).toBe("'Bob''s'");
  });
  it("ddmmyyyyToSerial khớp serial Google Sheets", () => {
    expect(ddmmyyyyToSerial("30/12/1899")).toBe(0);
    expect(ddmmyyyyToSerial("01/01/1900")).toBe(2);
    expect(ddmmyyyyToSerial("06/10/2026")).toBe(46301);
    expect(ddmmyyyyToSerial("2026-10-06")).toBeNull();
  });
});
