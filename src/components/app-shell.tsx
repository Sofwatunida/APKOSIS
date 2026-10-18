import { getPeriodeContext } from "@/lib/period";
import { getActiveImpersonation } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { DashboardShell } from "./dashboard-shell";

/**
 * Server component pembungkus dashboard.
 *
 * Mengambil periode aktif dari cookie + tabel `periods`, lalu
 * meneruskan ke `DashboardShell` supaya sidebar, dropdown periode,
 * dan seluruh query memakai satu periode yang sama.
 *
 * Untuk Super Admin yang sedang Mode Penyamaran, state penyamaran
 * ikut diteruskan supaya shell menampilkan banner "MODE PENYAMARAN
 * AKTIF". `getActiveImpersonation` selalu null untuk akun lain,
 * jadi tampilan role lain tidak berubah sama sekali.
 */
export async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [ctx, impersonation] = await Promise.all([
    getPeriodeContext(profile),
    getActiveImpersonation(),
  ]);

  return (
    <DashboardShell
      profile={profile}
      periods={ctx.options}
      allPeriodsMode={ctx.allPeriodsMode}
      readOnly={ctx.readOnly}
      selectedPeriodId={ctx.allPeriodsMode ? null : ctx.selected.id || null}
      impersonation={impersonation}
    >
      {children}
    </DashboardShell>
  );
}