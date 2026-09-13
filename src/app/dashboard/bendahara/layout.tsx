import { requireProfile, requireRole } from "@/lib/guard";

export default async function BendaharaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return <>{children}</>;
}