import type { Profile, Role } from "./types";

export function getRole(profile: Profile | null): Role | null {
  return profile?.role ?? null;
}

export function isDivisionAdmin(profile: Profile | null): boolean {
  return profile?.role === "division_admin";
}

export function isMonitoring(profile: Profile | null): boolean {
  return profile?.role === "monitoring";
}

export function isSekretaris(profile: Profile | null): boolean {
  return profile?.role === "sekretaris";
}

export function isBendahara(profile: Profile | null): boolean {
  return profile?.role === "bendahara";
}

export const ROLE_LABELS: Record<Role, string> = {
  division_admin: "Admin Divisi",
  monitoring: "Monitoring",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
};
