"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Nút "Đổi mật khẩu" cho MỌI người dùng đang đăng nhập (đặt ở header).
 * Xác minh mật khẩu hiện tại bằng signInWithPassword (cùng tài khoản nên KHÔNG
 * đăng xuất), rồi updateUser đổi sang mật khẩu mới. Không cần API/service role.
 */
export function ChangePasswordButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setOk(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (next !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // 1) Xác minh mật khẩu hiện tại.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInErr) {
        setError("Mật khẩu hiện tại không đúng.");
        return;
      }
      // 2) Đổi sang mật khẩu mới.
      const { error: updErr } = await supabase.auth.updateUser({
        password: next,
      });
      if (updErr) {
        setError(updErr.message || "Đổi mật khẩu thất bại.");
        return;
      }
      setOk(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
      >
        Đổi mật khẩu
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Đổi mật khẩu
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {ok ? (
              <div className="space-y-3">
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  ✅ Đã đổi mật khẩu thành công.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {busy ? "Đang đổi…" : "Đổi mật khẩu"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";
