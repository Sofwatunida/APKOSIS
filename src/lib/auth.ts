import { cache } from "react";
import { createClient } from "./supabase/server";
import { getImpersonation } from "./impersonation";
import type { Profile } from "./types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Profil ASLI dari tabel `profiles` — tanpa overlay penyamaran.
 *
 * Dipakai audit log dan aksi Super Admin supaya identitas asli tidak
 * pernah tertutup oleh Mode Penyamaran.
 */
export const getRealProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();

  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Query profil bisa gagal karena RLS / policy, bukan karena profilnya
  // memang kosong. Tanpa log, keduanya terlihat sama dari luar dan
  // dashboard hanya menampilkan "Akun belum dikonfigurasi".
  if (error) {
    console.error("[auth] gagal membaca profiles:", error.code, error.message);
    return null;
  }

  if (!data) {
    console.warn("[auth] tidak ada baris profiles untuk:", user.email);
    return null;
  }

  if (!data.role) {
    console.warn("[auth] profiles.role kosong untuk:", user.email);
  }

  return {
    id: data.id,
    nama: data.nama,
    email: data.email,
    role: data.role,
    divisi_id: data.divisi_id,
    periode_id: data.periode_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
});

/**
 * Profil yang dipakai seluruh aplikasi.
 *
 * Sama dengan `getRealProfile`, kecuali bila Mode Penyamaran aktif:
 * role (dan divisi) ditimpa oleh pilihan Super Admin sehingga seluruh
 * guard, sidebar, dan query melihat sistem sebagai role tujuan.
 *
 * PENJAGA KEAMANAN: overlay HANYA diterapkan bila profil asli adalah
 * `super_admin`. Akun lain mengabaikan cookie penyamaran sepenuhnya,
 * jadi tidak ada role yang bisa menaikkan hak aksesnya lewat cookie.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const real = await getRealProfile();
  if (!real || real.role !== "super_admin") return real;

  const imp = await getImpersonation();
  if (!imp) return real;

  return {
    ...real,
    role: imp.role,
    divisi_id: imp.role === "division_admin" ? imp.divisiId : real.divisi_id,
  };
});

/**
 * State penyamaran AKTIF, tapi hanya untuk akun Super Admin sungguhan.
 *
 * Mengembalikan null untuk semua non-super_admin sehingga cookie
 * penyamaran buatan user lain tidak pernah dihormati.
 */
export const getActiveImpersonation = cache(async () => {
  const real = await getRealProfile();
  if (!real || real.role !== "super_admin") return null;
  return getImpersonation();
});
