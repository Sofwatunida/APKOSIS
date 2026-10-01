import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getProfile } from "./auth";
import type { Profile } from "./types";
import {
  DIVISI_TOKEN_COOKIE,
  DIVISI_SESSION_MAX_AGE_SECONDS,
} from "./division-session-constants";

export interface DivisionSession {
  divisiId: string;
}

export async function getDivisionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DIVISI_TOKEN_COOKIE)?.value ?? null;
}

export const getDivisionSession = cache(
  async (): Promise<DivisionSession | null> => {
    const token = await getDivisionToken();
    if (!token) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("division_sessions")
      .select("divisi_id")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!data?.divisi_id) return null;
    return { divisiId: data.divisi_id };
  }
);

export const requireDivisionSelection = cache(async (): Promise<void> => {
  const profile = await getProfile();
  if (!profile || profile.role !== "division_admin") return;
  const session = await getDivisionSession();
  if (!session) redirect("/pilih-divisi");
});

export const getActiveDivisiId = cache(
  async (profile: Profile): Promise<string | null> => {
    if (profile.role !== "division_admin") return profile.divisi_id;
    const session = await getDivisionSession();
    return session?.divisiId ?? profile.divisi_id;
  }
);

export async function withActiveDivisi(profile: Profile): Promise<Profile> {
  const divisiId = await getActiveDivisiId(profile);
  if (divisiId === profile.divisi_id) return profile;
  return { ...profile, divisi_id: divisiId };
}

export async function setDivisionSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DIVISI_TOKEN_COOKIE, token, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIVISI_SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearDivisionSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DIVISI_TOKEN_COOKIE);
}
