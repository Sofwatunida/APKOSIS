import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const profile = await getProfile();

  if (!user) redirect("/login");

  return <div className="min-h-screen">{children}</div>;
}
