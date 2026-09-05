import { requireProfile, requireRole } from "@/lib/guard";
import { DashboardShell } from "@/components/dashboard-shell";
import { BendaharaTransaksiClient } from "./transaksi-client";

export default async function BendaharaTransaksiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <DashboardShell profile={profile}>
      <BendaharaTransaksiClient profile={profile} />
    </DashboardShell>
  );
}
