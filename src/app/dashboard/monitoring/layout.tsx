import { requireProfile, requireRole } from "@/lib/guard";

export default async function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  requireRole(profile, ["monitoring"]);
  return <>{children}</>;
}