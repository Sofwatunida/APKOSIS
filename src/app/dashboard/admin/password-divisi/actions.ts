"use server";

import { setDivisionPasswordAction } from "../../actions/periode-actions";

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
 * Penjagaan sesungguhnya ada di RLS + RPC database. Semua validasi,
 * audit, periode writable, dan revalidate dipusatkan di
 * `setDivisionPasswordAction` supaya tidak ada dua jalur berbeda.
 */
export async function saveDivisionPasswordAction(
  divisiId: string,
  password: string,
  periodeId?: string
): Promise<SaveDivisionPasswordResult> {
  const formData = new FormData();
  formData.set("divisi_id", divisiId);
  formData.set("password", password);
  formData.set("periode_id", periodeId ?? "");

  const result = await setDivisionPasswordAction(formData);
  return {
    ok: result.ok,
    message: result.message,
    updatedAt: result.updatedAt,
  };
}
