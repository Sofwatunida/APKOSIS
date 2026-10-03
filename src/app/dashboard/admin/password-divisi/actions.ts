"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface SaveDivisionPasswordResult {
  ok: boolean;
  message?: string;
  updatedAt?: string;
}

/**
 * Reset password divisi.
 *
 * Phase 8: halaman ini BUKAN lagi milik role divisi. Hanya Admin
 * periode dan Super Admin yang boleh mengubah kredensial divisi,
 * karena ketua/wakil tidak boleh mengganti password sendiri.
 *
 * Penjagaan sesungguhnya ada di RLS + fungsi `admin_set_division_password`
 * pada database; pengecekan di sini hanya lapisan pertama.
 */
export async function saveDivisionPasswordAction(
  divisiId: string,
  password: string,
  periodeId?: string
): Promise<SaveDivisionPasswordResult> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return {
      ok: false,
      message: "Hanya Admin atau Super Admin yang boleh mengatur password divisi.",
    };
  }

  if (!divisiId || !password) {
    return { ok: false, message: "Password divisi tidak boleh kosong." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_division_password", {
    p_divisi_id: divisiId,
    p_password: password,
    p_periode_id: periodeId ?? null,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ?? "Gagal menyimpan password divisi. Coba lagi.",
    };
  }

  revalidatePath("/dashboard/admin/password-divisi");
  revalidatePath("/dashboard/superadmin/akun");

  return { ok: true, updatedAt: data };
}
