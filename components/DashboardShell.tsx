import { Sidebar } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { ChangePasswordButton } from "@/components/ChangePasswordButton";
import { NAV_BY_ROLE, ROLE_LABELS, type UserRole } from "@/lib/constants";

export function DashboardShell({
  role,
  email,
  children,
}: {
  role: UserRole;
  email: string;
  children: React.ReactNode;
}) {
  const nav = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-gray-200 bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <p className="text-lg font-bold text-gray-900">timvideo</p>
          <p className="text-xs text-gray-400">Quản lý video affiliate</p>
        </div>
        <Sidebar nav={nav} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {ROLE_LABELS[role]}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-500 sm:inline">
              {email}
            </span>
            <ChangePasswordButton email={email} />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
