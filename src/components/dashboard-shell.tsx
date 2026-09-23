"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_STRUCTURE } from "@/lib/nav";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/role";
import { ToastProvider, useToast } from "@/components/ui/toast";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  CalendarRange,
  Package,
  ShoppingBag,
  Wallet,
  Building2,
  Layers,
  Coins,
  AlertCircle,
  CalendarDays,
  CalendarCheck2,
  LogOut,
  Menu,
  X,
  Sparkles,
  Calendar,
  ShieldCheck,
} from "lucide-react";

function getNavIcon(href: string) {
  if (href === "/dashboard") return LayoutDashboard;
  if (href.includes("laporan")) return ClipboardList;
  if (href.includes("anggota")) return Users;
  if (href.includes("program-kerja")) return CalendarRange;
  if (href.includes("inventaris")) return Package;
  if (href.includes("kebutuhan")) return ShoppingBag;
  if (href.includes("keuangan") || href.includes("transaksi")) return Wallet;
  if (href.includes("profil-divisi")) return Building2;
  if (href.includes("divisi")) return Layers;
  if (href.includes("rekap-keuangan")) return Coins;
  if (href.includes("rekap-kendala")) return AlertCircle;
  if (href.includes("rekap-bulanan")) return CalendarDays;
  if (href.includes("rekap-tahunan")) return CalendarCheck2;
  return LayoutDashboard;
}

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

  const sections = NAV_STRUCTURE.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  // User initials
  const displayName = profile.nama || profile.email || "Pengguna";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-950 text-slate-200">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-glow transition group-hover:scale-105">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white">APKOSIS</span>
                <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-400 border border-brand-500/20">
                  2026
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400">Portal Laporan OSIS</p>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const IconComponent = getNavIcon(item.href);
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150 ${
                          active
                            ? "bg-brand-500/15 text-white font-semibold border-l-2 border-brand-400 shadow-sm shadow-brand-500/10"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                      >
                        <IconComponent
                          className={`h-4 w-4 transition-colors ${
                            active
                              ? "text-brand-400"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* User Info & Logout Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-xs">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-950 lg:block shadow-elevated">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-fade-in">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-slate-950 shadow-2xl animate-slide-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3.5 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Sticky Modern Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 transition lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>{formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs text-slate-600 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">{ROLE_LABELS[role]}</span>
            </div>

            <div className="lg:hidden">
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
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

