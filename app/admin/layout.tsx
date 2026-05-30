import { requireRole } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["admin"]);
  return (
    <DashboardShell role={session.role} email={session.email}>
      {children}
    </DashboardShell>
  );
}
