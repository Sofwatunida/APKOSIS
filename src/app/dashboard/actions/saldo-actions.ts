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

/** Ubah pesan error database menjadi kalimat yang bisa dipahami pengguna. */
function friendlySaldoError(message: string): string {
  if (/row-level security/i.test(message)) {
    return "Saldo awal gagal disimpan karena kewenangan periode tidak cocok. Pastikan akun Anda berperan Bendahara dan periode yang dipilih masih aktif.";
  }
  if (/periode_id wajib|periode_id.*null/i.test(message)) {
    return "Periode belum ditentukan. Pilih satu periode aktif sebelum menyimpan saldo awal.";
  }
  if (/belum aktif/i.test(message)) {
    return "Periode ini belum aktif sehingga saldo awal tidak bisa diubah.";
  }
  if (/diarsipkan|hanya bisa dibaca|read only/i.test(message)) {
    return "Periode ini sudah diarsipkan dan hanya bisa dibaca. Hubungi Super Admin untuk koreksi.";
  }
  if (/saldo_awal_nominal_nonnegative|check constraint/i.test(message)) {
    return "Nominal saldo awal tidak valid. Nilai tidak boleh negatif.";
  }
  if (/duplicate key|unique/i.test(message)) {
    return "Saldo awal untuk tujuan dan periode ini sudah ada. Muat ulang halaman lalu edit nominalnya.";
  }
  return message;
}

/**
 * Menyimpan saldo awal Bendahara (kas pusat) atau saldo awal satu
 * divisi pada periode yang sedang dipilih.
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

  const target = String(formData.get("target") ?? "divisi");
  const isBendahara = target === "bendahara";
  const divisiId = isBendahara
    ? null
    : String(formData.get("divisi_id") ?? "").trim();
  const rawNominal = String(formData.get("nominal") ?? "").trim();
  const nominal = Number(rawNominal);

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
      message: ctx.readOnly
        ? "Periode arsip tidak bisa diubah."
        : "Periode ini belum aktif sehingga saldo awal tidak bisa diubah.",
    };
  }

  if (!isBendahara && !divisiId) {
    return { ok: false, message: "Pilih divisi terlebih dahulu." };
  }
  if (rawNominal === "") {
    return { ok: false, message: "Nominal saldo awal wajib diisi." };
  }
  if (!Number.isFinite(nominal) || nominal < 0) {
    return { ok: false, message: "Nominal saldo awal tidak valid." };
  }
  if (nominal > MAX_NOMINAL) {
    return { ok: false, message: "Nominal saldo awal terlalu besar." };
  }

  const nominalRounded = Math.round(nominal * 100) / 100;
  const supabase = await createClient();
  const { error } = await saveSaldoAwal(supabase, {
    nominal: nominalRounded,
    userId: profile.id,
    periodeId: ctx.selected.id,
    divisiId,
  });

  const auditTargetType = isBendahara ? "saldo_awal_bendahara" : "saldo_awal";

  if (error) {
    await writeAuditLog({
      action: "ubah_saldo_awal",
      targetType: auditTargetType,
      targetId: divisiId ?? undefined,
      detail: `nominal=${nominalRounded}`,
      success: false,
    });
    return { ok: false, message: friendlySaldoError(error.message) };
  }

  await writeAuditLog({
    action: "ubah_saldo_awal",
    targetType: auditTargetType,
    targetId: divisiId ?? undefined,
    detail: `nominal=${nominalRounded}`,
    success: true,
  });

  revalidatePath("/dashboard/bendahara/transaksi");
  revalidatePath("/dashboard/bendahara/rekap-bulanan");
  revalidatePath("/dashboard/bendahara/rekap-tahunan");
  revalidatePath("/dashboard/monitoring/rekap-keuangan");
  revalidatePath("/dashboard/sekretaris/rekap-keuangan");
  revalidatePath("/dashboard/detail-keuangan");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: isBendahara
      ? "Saldo awal Bendahara berhasil disimpan."
      : "Saldo awal divisi berhasil disimpan.",
  };
}
