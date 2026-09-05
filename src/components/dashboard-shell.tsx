"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_STRUCTURE } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/role";
import { ToastProvider, useToast } from "@/components/ui/toast";

function ShellInner({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile.role ?? "division_admin";

  const sections = NAV_STRUCTURE.filter((section) =>
    section.items.some((item) => item.roles.includes(role))
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-brand-800 px-5">
        <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-white">
          APKOSIS
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-brand-300">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      isActive(item.href)
                        ? "bg-brand-500/20 font-medium text-white"
                        : "text-brand-100 hover:bg-brand-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-brand-800 px-5 py-4">
        <p className="truncate text-sm font-medium text-white">
          {profile.nama || profile.email}
        </p>
        <p className="text-xs text-brand-300">{ROLE_LABELS[role]}</p>
        <button
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg bg-brand-700 px-3 py-2 text-sm text-white transition hover:bg-brand-600"
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-900 lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-brand-100 hover:bg-brand-800"
              aria-label="Tutup menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Buka menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-700 lg:hidden">APKOSIS</span>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-slate-500">{ROLE_LABELS[role]}</span>
          </div>
          <div className="lg:hidden">
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ShellInner profile={profile}>{children}</ShellInner>
    </ToastProvider>
  );
}
