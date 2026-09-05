import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardHome } from "./dashboard-home";
import { NotConfigured } from "./not-configured";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile || !profile.role) return <NotConfigured />;

  return (
    <DashboardShell profile={profile}>
      <DashboardHome profile={profile} />
    </DashboardShell>
  );
}
