import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import type { Profile, Role } from "@/lib/types";

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
