import { NextResponse } from "next/server";

/** Lỗi nghiệp vụ có status code rõ ràng. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function jsonError(
  status: number,
  message: string,
  code?: string,
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

type PgError = { code?: string; message?: string; details?: string };

/** Chuẩn hóa mọi lỗi route thành Response. */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message, err.code);
  }
  const pg = err as PgError;
  // 23505 = unique_violation (vd: trùng canonical_video_hash)
  if (pg?.code === "23505") {
    return jsonError(409, "Video này đã tồn tại trong hệ thống", "DUPLICATE");
  }
  // 23503 = foreign_key_violation (vd: affiliate/category không tồn tại)
  if (pg?.code === "23503") {
    return jsonError(400, "Tham chiếu không hợp lệ (bản ghi liên kết không tồn tại)", "FK_VIOLATION");
  }
  // Các lỗi RLS / trigger từ Postgres
  if (typeof pg?.message === "string" && pg.message.includes("FORBIDDEN")) {
    return jsonError(403, "Bạn không có quyền thực hiện thao tác này", "FORBIDDEN");
  }
  console.error("[api] Unhandled error:", err);
  return jsonError(500, "Lỗi hệ thống, vui lòng thử lại sau");
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Body JSON không hợp lệ");
  }
}
