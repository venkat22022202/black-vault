import { syncUser } from "./sync-user";
import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sync Clerk user to our DB on every dashboard load
  await syncUser();

  return <DashboardShell>{children}</DashboardShell>;
}
