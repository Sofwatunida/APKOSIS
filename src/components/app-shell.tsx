import { getPeriodeContext } from "@/lib/period";
import { getActiveImpersonation } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { DashboardShell } from "./dashboard-shell";

/**
 * Shell persisten yang dipasang SEKALI di `dashboard/layout.tsx`.
 *
 * Dengan mengambil periode aktif + state penyamaran di layout, sidebar,
 * header, dan provider tidak ikut di-fetch/di-render ulang setiap kali
 * user berpindah fitur. Hanya konten halaman yang berubah.
 *
 * Untuk Super Admin yang sedang Mode Penyamaran, state penyamaran
 * ikut diteruskan supaya shell menampilkan banner "MODE PENYAMARAN
 * AKTIF". `getActiveImpersonation` selalu null untuk akun lain,
 * jadi tampilan role lain tidak berubah sama sekali.
 */
export async function AppShellRoot({
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

/**
 * Kompatibilitas untuk halaman lama yang masih membungkus kontennya
 * dengan `<AppShell profile={profile}>`.
 *
 * Shell asli sekarang berada di `dashboard/layout.tsx`. Wrapper ini
 * sengaja menjadi pass-through agar tidak ada sidebar ganda dan tidak
 * ada query periode tambahan saat navigasi. Halaman baru tidak perlu
 * memakai wrapper ini.
 */
export function AppShell({
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}