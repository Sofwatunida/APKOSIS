import { NextResponse } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildKeuanganWorkbook } from "@/lib/export";

export async function POST() {
  const user = await getCurrentUser();
  const profile = await getProfile();

  if (!user || !profile?.role) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (profile.role !== "bendahara") {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const { data: divisi } = await supabase.from("divisi").select("*").order("nomor_divisi");
    const { data: txs } = await supabase
      .from("transaksi_keuangan")
      .select("*, divisi(nama_divisi)")
      .order("tanggal", { ascending: false });

    const divMap = new Map((divisi ?? []).map((d) => [d.id, d.nama_divisi]));
    const transaksi = (txs ?? []).map((t: any) => ({
      ...t,
      nama_divisi: t.divisi?.nama_divisi ?? divMap.get(t.divisi_id) ?? "-",
    }));

    const wb = await buildKeuanganWorkbook(divisi ?? [], transaksi);
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="apkosis-keuangan-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Export keuangan error:", err);
    return NextResponse.json({ error: "Gagal membuat export" }, { status: 500 });
  }
}
