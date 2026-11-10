import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { AppShellRoot } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  if (!profile || !profile.role) redirect("/login");

  return <AppShellRoot profile={profile}>{children}</AppShellRoot>;
}
