import type { Profile, Role } from "./types";

export function getRole(profile: Profile | null): Role | null {
  return profile?.role ?? null;
}

/** Super Admin = pemilik sistem, satu-satunya yang boleh mengelola periode & arsip. */
export function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.role === "super_admin";
}

/** Admin = pengelola operasional satu periode kepengurusan. */
export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

/** Super Admin implicitly juga punya akses Admin. */
export function isAdminOrSuper(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "super_admin";
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
  super_admin: "Super Admin",
  admin: "Admin Periode",
  division_admin: "Admin Divisi",
  monitoring: "Monitoring",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
};