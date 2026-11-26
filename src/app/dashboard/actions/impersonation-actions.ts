"use server";

import { redirect } from "next/navigation";
import { getActiveImpersonation, getRealProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { formatDivisiLabel } from "@/lib/divisi-options";
import {
  clearImpersonationCookie,
  setImpersonationCookie,
  IMPERSONATABLE_ROLES,
} from "@/lib/impersonation";
import type { Role } from "@/lib/types";

export interface ImpersonationActionResult {
  ok: boolean;
  message: string;
}

function fail(message: string): ImpersonationActionResult {
  return { ok: false, message };
}

/**
 * Penjaga bersama: SEMUA aksi penyamaran memakai profil ASLI
 * (getRealProfile), bukan profil hasil overlay, sehingga tidak ada
 * "penyamaran berlapis" dan hanya akun super_admin sungguhan yang
 * bisa memulai/menghentikan mode ini.
 */
async function requireRealSuperAdmin(): Promise<
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      real: NonNullable<Awaited<ReturnType<typeof getRealProfile>>>;
    }
  | { error: ImpersonationActionResult }
> {
  const real = await getRealProfile();
  if (!real || real.role !== "super_admin") {
    return { error: fail("Hanya Super Admin yang boleh memakai Mode Penyamaran.") };
  }
  return { supabase: await createClient(), real };
}

/**
 * Masuk Mode Penyamaran.
 *
 * Sesi Supabase asli TIDAK diubah, password TIDAK disentuh, dan
 * identitas asli tetap Super Admin. Yang ditambah hanya cookie
 * httpOnly penunjuk tampilan, sehingga "session Super Admin asli
 * tidak pernah dihapus" sesuai kebijakan.
 */
export async function startImpersonationAction(input: {
  accountId: string;
  divisiId?: string | null;
}): Promise<ImpersonationActionResult> {
  const auth = await requireRealSuperAdmin();
  if ("error" in auth) return auth.error;
  const { supabase, real } = auth;

  const accountId = (input.accountId ?? "").trim();
  if (!accountId) return fail("Akun tujuan tidak ditemukan.");

  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, nama, email, role, divisi_id, periode_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !target) return fail("Akun tujuan tidak ditemukan.");
  if (target.id === real.id) {
    return fail("Tidak dapat menyamar menggunakan akun sendiri.");
  }

  const role = target.role as Role;
  if (!IMPERSONATABLE_ROLES.includes(role)) {
    return fail("Akun ini tidak diizinkan untuk Mode Penyamaran.");
  }

  let divisiId: string | null = null;
  let divisiDetail = "";
  if (role === "division_admin") {
    const requestedDivisiId = (input.divisiId ?? "").trim();
    divisiId = requestedDivisiId || target.divisi_id || null;
    if (!divisiId) return fail("Pilih dulu divisi yang ingin dimasuki.");
    const { data: divisi } = await supabase
      .from("divisi")
      .select("id, nomor_divisi, nama_divisi")
      .eq("id", divisiId)
      .maybeSingle();
    if (!divisi) return fail("Divisi tujuan tidak ditemukan.");
    divisiDetail = ` (${formatDivisiLabel(divisi.nomor_divisi, divisi.nama_divisi)})`;
  }

  const accountName = target.nama?.trim() || target.email || "Akun tujuan";

  await setImpersonationCookie({
    role,
    divisiId,
    periodeId: target.periode_id,
    accountId: target.id,
    accountName,
  });

  await writeAuditLog({
    action: "mulai_mode_penyamaran",
    targetType: "profile",
    targetId: target.id,
    detail: `akun ${accountName} (${target.email ?? "-"}) sebagai ${role}${divisiDetail}`,
    success: true,
  });

  // Sengaja TIDAK memakai redirect(): aksi ini dipanggil langsung dari
  // client (bukan form), dan respons redirect membuat promise-nya
  // resolve `undefined`. Kembalikan hasil eksplisit; navigasi ke
  // dashboard role tujuan dilakukan client setelah `ok`.
  return { ok: true, message: "Mode Penyamaran aktif." };
}

/**
 * Kembali ke Super Admin.
 *
 * Memicu redirect ke dashboard Super Admin; cookie penyamaran
 * dihapus lebih dulu supaya tampilan kembali normal seketika.
 */
export async function stopImpersonationAction(): Promise<void> {
  const auth = await requireRealSuperAdmin();
  if ("error" in auth) redirect("/dashboard");

  const active = await getActiveImpersonation();
  await writeAuditLog({
    action: "akhiri_mode_penyamaran",
    targetType: "role",
    detail: `kembali ke tampilan Super Admin${
      active?.accountName ? ` dari akun ${active.accountName}` : ""
    }`,
    success: true,
  });

  await clearImpersonationCookie();
  redirect("/dashboard/superadmin");
}
