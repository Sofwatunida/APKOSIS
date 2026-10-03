import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { DetailKeuanganClient } from "./detail-keuangan-client";

export default async function DetailKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireProfile();
  // Halaman detail hanya untuk pemantau keuangan: Monitoring, Sekretaris, Bendahara.
  requireRole(profile, ["monitoring", "sekretaris", "bendahara"]);

  const sp = await searchParams;
  const pick = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  return (
    <AppShell profile={profile}>
      <DetailKeuanganClient
        profile={profile}
        initialDivisi={pick("divisi") ?? ""}
        initialPeriode={pick("periode") ?? ""}
      />
    </AppShell>
  );
}
