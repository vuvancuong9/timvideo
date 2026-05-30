const TZ = "Asia/Ho_Chi_Minh";

function toNumber(n: number | string | null | undefined): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = typeof n === "string" ? Number.parseFloat(n) : n;
  return Number.isFinite(v) ? v : null;
}

export function formatCurrency(n: number | string | null | undefined): string {
  const v = toNumber(n);
  if (v === null) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(v))} ₫`;
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = toNumber(n);
  if (v === null) return "0";
  return new Intl.NumberFormat("vi-VN").format(v);
}

export function formatPercent(n: number | string | null | undefined): string {
  const v = toNumber(n);
  if (v === null) return "—";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(v)}%`;
}

// timeZone cố định -> server & client cho cùng kết quả (tránh hydration mismatch).
export function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
