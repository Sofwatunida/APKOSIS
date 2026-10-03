import { getPeriodeContext } from "@/lib/period";
import type { Profile } from "@/lib/types";
import { DashboardShell } from "./dashboard-shell";

/**
 * Server component pembungkus dashboard.
 *
 * Mengambil periode aktif dari cookie + tabel `periods`, lalu
 * meneruskan ke `DashboardShell` supaya sidebar, dropdown periode,
 * dan seluruh query memakai satu periode yang sama.
 */
export async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const ctx = await getPeriodeContext(profile);

  return (
    <DashboardShell
      profile={profile}
      periods={ctx.options}
      allPeriodsMode={ctx.allPeriodsMode}
      readOnly={ctx.readOnly}
      selectedPeriodId={ctx.allPeriodsMode ? null : ctx.selected.id || null}
    >
      {children}
    </DashboardShell>
  );
}