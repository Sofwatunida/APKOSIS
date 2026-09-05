import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    nama: data.nama,
    email: data.email,
    role: data.role,
    divisi_id: data.divisi_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
