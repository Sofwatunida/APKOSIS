import { requireProfile, requireRole } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { SEMUA_DIVISI_LABEL, SEMUA_DIVISI_VALUE } from "@/lib/divisi-options";
import { RekapKendalaSekretarisClient } from "./rekap-kendala-sekretaris-client";

interface SekretarisRekapKendalaPageProps {
  searchParams: Promise<{ divisi?: string | string[] }>;
}

export default async function SekretarisRekapKendalaPage({
  searchParams,
}: SekretarisRekapKendalaPageProps) {
  const { profile } = await requireProfile();
  requireRole(profile, ["sekretaris"]);

  const params = await searchParams;
  const hasDivisiParam = typeof params.divisi === "string";
  const requestedDivisiId = hasDivisiParam ? (params.divisi as string) : "";

  const supabase = await createClient();
  const { data } = await supabase
    .from("divisi")
    .select("id, nomor_divisi, nama_divisi")
    .order("nomor_divisi", { ascending: true });

  const divisi = [
    {
      id: SEMUA_DIVISI_VALUE,
      nomorDivisi: null,
      namaDivisi: SEMUA_DIVISI_LABEL,
    },
    ...(data ?? []).map((d) => ({
      id: d.id,
      nomorDivisi: d.nomor_divisi,
      namaDivisi: d.nama_divisi ?? "",
    })),
  ];
  const selected = hasDivisiParam
    ? divisi.find((d) => d.id === requestedDivisiId) ?? null
    : null;

  return (
    <AppShell profile={profile}>
      <RekapKendalaSekretarisClient divisi={divisi} selected={selected} />
    </AppShell>
  );
}
