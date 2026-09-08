import { AppShell } from "./shell";
import { getSessionUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return <AppShell userEmail={user?.email}>{children}</AppShell>;
}
