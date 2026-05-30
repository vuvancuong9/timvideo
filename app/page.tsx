import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role]);
}
