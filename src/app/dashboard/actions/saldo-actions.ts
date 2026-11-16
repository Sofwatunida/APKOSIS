"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { saveSaldoAwal } from "@/lib/finance";
import { getPeriodeContext } from "@/lib/period";

export interface SaldoActionResult {
  ok: boolean;
  message: string;
}

const MAX_NOMINAL = 9_999_999_999_999.99;

/**
 * Menyimpan saldo awal untuk satu divisi pada periode yang sedang dipilih.
 *
 * - Hanya Bendahara (dan Super Admin untuk koreksi) yang boleh menulis.
 * - Nominal divalidasi di server, bukan hanya di form.
 * - Setiap perubahan dicatat ke `audit_logs` (berhasil maupun gagal).
 */
export async function saveSaldoAwalAction(
  formData: FormData
): Promise<SaldoActionResult> {
  const profile = await getProfile();
  if (
    !profile ||
    (profile.role !== "bendahara" && profile.role !== "super_admin")
  ) {
    return {
      ok: false,
      message: "Hanya Bendahara yang boleh mengatur saldo awal.",
    };
  }

  const divisiId = String(formData.get("divisi_id") ?? "").trim();
  const nominal = Number(formData.get("nominal"));

  const ctx = await getPeriodeContext(profile);
  if (ctx.allPeriodsMode || !ctx.selected.id) {
    return {
      ok: false,
      message: "Pilih satu periode spesifik sebelum mengatur saldo awal.",
    };
  }
  if (!ctx.canWrite) {
    return {
      ok: false,
      message: "Periode arsip tidak bisa diubah.",
    };
  }

  if (!divisiId) {
    return { ok: false, message: "Pilih divisi terlebih dahulu." };
  }
  if (!Number.isFinite(nominal) || nominal < 0) {
    return { ok: false, message: "Nominal saldo awal tidak valid." };
  }
  if (nominal > MAX_NOMINAL) {
    return { ok: false, message: "Nominal saldo awal terlalu besar." };
  }

  const supabase = await createClient();
  const { error } = await saveSaldoAwal(
    supabase,
    nominal,
    profile.id,
    divisiId
  );

  if (error) {
    await writeAuditLog({
      action: "ubah_saldo_awal",
      targetType: "saldo_awal",
      targetId: divisiId,
      detail: `nominal=${nominal}`,
      success: false,
    });
    return { ok: false, message: error.message };
  }

  await writeAuditLog({
    action: "ubah_saldo_awal",
    targetType: "saldo_awal",
    targetId: divisiId,
    detail: `nominal=${nominal}`,
    success: true,
  });

  revalidatePath("/dashboard/bendahara/transaksi");
  revalidatePath("/dashboard/bendahara/rekap-bulanan");
  revalidatePath("/dashboard/bendahara/rekap-tahunan");
  revalidatePath("/dashboard/monitoring/rekap-keuangan");
  revalidatePath("/dashboard/sekretaris/rekap-keuangan");
  revalidatePath("/dashboard/detail-keuangan");
  revalidatePath("/dashboard");

  return { ok: true, message: "Saldo awal divisi berhasil disimpan." };
}
