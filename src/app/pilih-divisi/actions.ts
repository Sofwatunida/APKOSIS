"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  clearDivisionSessionCookie,
  getDivisionToken,
  setDivisionSessionCookie,
} from "@/lib/division-session";

export interface StartDivisionSessionResult {
  ok: boolean;
  message?: string;
}

export async function startDivisionSessionAction(
  divisiId: string,
  password: string
): Promise<StartDivisionSessionResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "division_admin") {
    return { ok: false, message: "Akses halaman ini hanya untuk akun divisi." };
  }

  if (!divisiId || !password) {
    return {
      ok: false,
      message: "Pilih divisi dan masukkan password divisi.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_division_session", {
    p_divisi_id: divisiId,
    p_password: password,
  });

  if (error || !data) {
    return {
      ok: false,
      message:
        error?.message ??
        "Password divisi salah atau divisi belum memiliki password.",
    };
  }

  await setDivisionSessionCookie(data);
  revalidatePath("/dashboard", "layout");

  return { ok: true };
}

export async function endDivisionSessionAction(): Promise<void> {
  const token = await getDivisionToken();

  if (token) {
    const supabase = await createClient();
    await supabase.rpc("end_division_session", { p_token: token });
  }

  await clearDivisionSessionCookie();
  revalidatePath("/", "layout");
}
