import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import {
  getDivisionSession,
  withActiveDivisi,
} from "@/lib/division-session";
import { AppShell } from "@/components/app-shell";
import { DashboardHome } from "./dashboard-home";
import { NotConfigured } from "./not-configured";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile || !profile.role) return <NotConfigured />;

  // Super Admin dan Admin punya dashboard sendiri supaya halaman utama
  // tetap khusus untuk operasional divisi/ketua OSIS.
  if (profile.role === "super_admin") redirect("/dashboard/superadmin");
  if (profile.role === "admin") redirect("/dashboard/admin");

  if (profile.role === "division_admin") {
    const session = await getDivisionSession();
    if (!session) redirect("/pilih-divisi");
  }

  const scopedProfile = await withActiveDivisi(profile);

  return (
    <AppShell profile={scopedProfile}>
      <DashboardHome profile={scopedProfile} />
    </AppShell>
  );
}
