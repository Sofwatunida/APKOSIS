import { requireProfile, requireAdminAccess } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { ProgramKerjaBendaharaClient } from "../../program-kerja/program-kerja-bendahara-client";

export const dynamic = "force-dynamic";

/**
 * Kontrol Semua Program Kerja (khusus Admin & Super Admin).
 *
 * Memakai client program kerja yang sama dengan halaman bendahara
 * (pilih divisi -> kelola program divisi tersebut), namun dengan
 * mode "kontrol": tambah, ubah, hapus, unduh, dan catatan program
 * belum terlaksana. Tidak ada CRUD/route/database baru.
 */
export default async function AdminProgramKerjaPage() {
  const { profile } = await requireProfile();
  requireAdminAccess(profile);

  return (
    <AppShell profile={profile}>
      <ProgramKerjaBendaharaClient profile={profile} mode="kontrol" />
    </AppShell>
  );
}
