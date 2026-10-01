import { DIVISI_TOKEN_COOKIE } from "./division-session-constants";

/**
 * Menghapus cookie sesi divisi di sisi browser.
 * Dipanggil saat logout supaya akun divisi tidak bisa langsung
 * masuk kembali ke divisi terakhir tanpa diminta password lagi.
 * Tidak berefek pada monitoring / sekretaris / bendahara karena
 * cookie ini hanya pernah dibuat untuk akun division_admin.
 */
export function clearDivisionTokenCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DIVISI_TOKEN_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
}
