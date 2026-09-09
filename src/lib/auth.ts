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
});
