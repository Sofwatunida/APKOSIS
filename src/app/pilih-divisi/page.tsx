import { redirect } from "next/navigation";
import { getCurrentUser, getProfile, getActiveImpersonation } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDivisionSession } from "@/lib/division-session";
import { PilihDivisiClient } from "./pilih-divisi-client";

export default async function PilihDivisiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "division_admin") redirect("/dashboard");
  // Mode Penyamaran: divisi tujuan sudah ditentukan dari cookie, dan
  // RPC sesi divisi menolak akun non-divisi — jadi kembali ke dashboard.
  if (await getActiveImpersonation()) redirect("/dashboard");

  const supabase = await createClient();
  const { data: divisi } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi", { ascending: true });

  const session = await getDivisionSession();

  return (
    <PilihDivisiClient
      divisi={(divisi ?? []).map((d) => ({
        id: d.id,
        nomorDivisi: d.nomor_divisi,
        namaDivisi: d.nama_divisi,
      }))}
      activeDivisiId={session?.divisiId ?? null}
    />
  );
}
