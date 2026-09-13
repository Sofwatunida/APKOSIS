import { requireProfile, requireRole } from "@/lib/guard";

export default async function SekretarisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);
  return <>{children}</>;
}