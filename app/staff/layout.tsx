import { requireRole } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["staff"]);
  return (
    <DashboardShell role={session.role} email={session.email}>
      {children}
    </DashboardShell>
  );
}
