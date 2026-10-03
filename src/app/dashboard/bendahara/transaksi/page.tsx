import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { BendaharaTransaksiClient } from "./transaksi-client";

export default async function BendaharaTransaksiPage() {
  const { profile } = await requireProfile();
  requireRole(profile, ["bendahara"]);
  return (
    <AppShell profile={profile}>
      <BendaharaTransaksiClient profile={profile} />
    </AppShell>
  );
}
