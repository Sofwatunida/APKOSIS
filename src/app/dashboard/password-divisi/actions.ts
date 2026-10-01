"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface SaveDivisionPasswordResult {
  ok: boolean;
  message?: string;
  updatedAt?: string;
}

export async function saveDivisionPasswordAction(
  divisiId: string,
  password: string
): Promise<SaveDivisionPasswordResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "division_admin") {
    return {
      ok: false,
      message: "Akses hanya untuk akun divisi (division_admin).",
    };
  }

  if (!divisiId || !password) {
    return { ok: false, message: "Password divisi tidak boleh kosong." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_division_password", {
    p_divisi_id: divisiId,
    p_password: password,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ?? "Gagal menyimpan password divisi. Coba lagi.",
    };
  }

  revalidatePath("/dashboard/password-divisi");

  return { ok: true, updatedAt: data };
}
