import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
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
