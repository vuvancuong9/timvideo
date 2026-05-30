import Link from "next/link";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const session = await getOptionalSession();
  const home = session ? ROLE_HOME[session.role] : "/login";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 p-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900">403 — Không có quyền</h1>
      <p className="max-w-md text-gray-600">
        Tài khoản của bạn không được phép truy cập khu vực này.
        {session && (
          <>
            {" "}
            Quyền hiện tại:{" "}
            <span className="font-semibold">{ROLE_LABELS[session.role]}</span>.
          </>
        )}
      </p>
      <div className="flex items-center gap-3">
        <Link
          href={home}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Về trang chính
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
