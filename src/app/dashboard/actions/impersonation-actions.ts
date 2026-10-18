"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRealProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
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
  { supabase: Awaited<ReturnType<typeof createClient>> } | { error: ImpersonationActionResult }
> {
  const real = await getRealProfile();
  if (!real || real.role !== "super_admin") {
    return { error: fail("Hanya Super Admin yang boleh memakai Mode Penyamaran.") };
  }
  return { supabase: await createClient() };
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
  role: string;
  divisiId?: string | null;
}): Promise<ImpersonationActionResult> {
  const auth = await requireRealSuperAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const role = input.role as Role;
  if (!IMPERSONATABLE_ROLES.includes(role)) {
    return fail("Role tujuan tidak dikenal untuk Mode Penyamaran.");
  }

  let divisiId: string | null = null;
  if (role === "division_admin") {
    divisiId = (input.divisiId ?? "").trim() || null;
    if (!divisiId) {
      return fail("Pilih dulu divisi yang ingin ditiru untuk Admin Divisi.");
    }
    const { data } = await supabase
      .from("divisi")
      .select("id, nama_divisi")
      .eq("id", divisiId)
      .maybeSingle();
    if (!data) return fail("Divisi tujuan tidak ditemukan.");
  }

  await setImpersonationCookie({ role, divisiId });

  await writeAuditLog({
    action: "mulai_mode_penyamaran",
    targetType: "role",
    targetId: role,
    detail: divisiId ? `${role} (divisi ${divisiId})` : role,
    success: true,
  });

  revalidatePath("/", "layout");

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

  await writeAuditLog({
    action: "akhiri_mode_penyamaran",
    targetType: "role",
    detail: "kembali ke tampilan Super Admin",
    success: true,
  });

  await clearImpersonationCookie();
  revalidatePath("/", "layout");
  redirect("/dashboard/superadmin");
}
