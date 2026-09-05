import { NextResponse } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { buildAdministrasiWorkbook, fetchAdministrasiData } from "@/lib/export";

export async function POST() {
  const user = await getCurrentUser();
  const profile = await getProfile();

  if (!user || !profile?.role) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (profile.role !== "sekretaris") {
    return NextResponse.json({ error: "Tidak memiliki izin" }, { status: 403 });
  }

  try {
    const data = await fetchAdministrasiData();
    const wb = await buildAdministrasiWorkbook(data);
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="apkosis-administrasi-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Gagal membuat export" }, { status: 500 });
  }
}
