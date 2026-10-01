import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import {
  getDivisionSession,
  withActiveDivisi,
} from "@/lib/division-session";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardHome } from "./dashboard-home";
import { NotConfigured } from "./not-configured";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile || !profile.role) return <NotConfigured />;

  if (profile.role === "division_admin") {
    const session = await getDivisionSession();
    if (!session) redirect("/pilih-divisi");
  }

  const scopedProfile = await withActiveDivisi(profile);

  return (
    <DashboardShell profile={scopedProfile}>
      <DashboardHome profile={scopedProfile} />
    </DashboardShell>
  );
}
