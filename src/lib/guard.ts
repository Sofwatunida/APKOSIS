import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "./auth";
import type { Profile, Role } from "./types";

export async function requireProfile(): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; profile: Profile }> {
  const user = await getCurrentUser();
  const profile = await getProfile();
  if (!user) redirect("/login");
  if (!profile || !profile.role) redirect("/login");
  return { user, profile };
}

export function requireRole(profile: Profile, roles: Role[]): void {
  if (!profile.role || !roles.includes(profile.role)) {
    redirect("/dashboard");
  }
}

/** Halaman khusus Super Admin. */
export function requireSuperAdmin(profile: Profile): void {
  if (profile.role !== "super_admin") redirect("/dashboard");
}

/** Halaman Admin Periode. Super Admin boleh masuk juga untuk recovery. */
export function requireAdminAccess(profile: Profile): void {
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }
}