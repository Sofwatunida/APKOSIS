import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDivisionSession } from "@/lib/division-session";
import { PilihDivisiClient } from "./pilih-divisi-client";

export default async function PilihDivisiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "division_admin") redirect("/dashboard");

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
