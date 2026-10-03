"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearDivisionTokenCookie } from "@/lib/division-session-client";
import { PeriodeProvider } from "@/lib/periode-context";
import { NAV_STRUCTURE } from "@/lib/nav";
import type { PeriodeOption } from "@/lib/period";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/role";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { PeriodePicker } from "@/components/periode-picker";
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
  Calendar,
  HandCoins,
  KeyRound,
  ShieldCheck,
  Settings2,
  Archive,
} from "lucide-react";

function getNavIcon(href: string) {
  if (href === "/dashboard") return LayoutDashboard;
  if (href.includes("pengajuan-dana")) return HandCoins;
  if (href.includes("laporan")) return ClipboardList;
  if (href.includes("anggota")) return Users;
  if (href.includes("program-kerja")) return CalendarRange;
  if (href.includes("inventaris")) return Package;
  if (href.includes("kebutuhan")) return ShoppingBag;
  if (href.includes("keuangan") || href.includes("transaksi")) return Wallet;
  if (href.includes("profil-divisi")) return Building2;
  if (href.includes("password-divisi")) return KeyRound;
  if (href.includes("superadmin") || href.includes("periode")) return ShieldCheck;
  if (href.includes("pengaturan")) return Settings2;
  if (href.includes("divisi")) return Layers;
  if (href.includes("rekap-keuangan")) return Coins;
  if (href.includes("rekap-kendala")) return AlertCircle;
  if (href.includes("rekap-bulanan")) return CalendarDays;
  if (href.includes("rekap-tahunan")) return CalendarCheck2;
  return LayoutDashboard;
}

function ShellInner({
  profile,
  periods,
  allPeriodsMode,
  readOnly,
  selectedPeriodId,
  children,
}: {
  profile: Profile;
  periods: PeriodeOption[];
  allPeriodsMode: boolean;
  readOnly: boolean;
  selectedPeriodId: string | null;
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
    clearDivisionTokenCookie();
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

  // Badge Never hardcoded: selalu dari tabel `periods`.
  const activePeriodBadge =
    periods.find((p) => p.id === selectedPeriodId)?.tahunMulai ??
    periods.find((p) => p.status === "active")?.tahunMulai ??
    periods[0]?.tahunMulai ??
    "-";

  const sidebarContent = (
    <div className="sidebar-surface flex h-full flex-col justify-between">
      <div>
        {/* Brand Header - identitas hanya tulisan "APKOSIS", tanpa logo/icon tambahan */}
        <div className="flex h-16 items-center border-b border-slate-200/80 px-5 dark:border-slate-800/80">
          <Link href="/dashboard" className="group flex min-w-0 flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="sidebar-brand-text text-xl font-extrabold leading-none tracking-[-0.02em]">
                APKOSIS
              </span>
              <span className="rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                {activePeriodBadge}
              </span>
            </div>
            <p className="sidebar-subtle mt-1 text-[10px] font-medium leading-none">
              Portal Laporan OSIS
            </p>
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="sidebar-section-title mb-2 px-3 text-[11px] font-bold uppercase tracking-wider">
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
                        className={`group flex items-center gap-3 rounded-xl py-2.5 pl-3 pr-3 text-xs font-medium transition-all duration-150 ${
                          active ? "sidebar-link-active font-semibold" : "sidebar-link"
                        }`}
                      >
                        <IconComponent
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? "text-brand-600 dark:text-brand-400"
                              : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200"
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

      {/* User Info & Logout */}
      <div className="border-t border-slate-200/80 p-3 dark:border-slate-800/80">
        <div className="sidebar-user-card flex items-center gap-3 rounded-xl border p-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-xs">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="sidebar-brand-text truncate text-xs font-semibold">
              {displayName}
            </p>
            <p className="sidebar-subtle truncate text-[11px]">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            aria-label="Keluar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r shadow-card lg:block dark:shadow-elevated">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 border-r shadow-2xl animate-slide-up">
            {sidebarContent}
          </aside>
          <button
            onClick={() => setMobileOpen(false)}
            className="fixed right-4 top-4 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-card transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:px-8 dark:border-slate-800/80 dark:bg-slate-900/85">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{formattedDate}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PeriodePicker canSelectAllPeriods={profile.role === "super_admin"} />
            <ThemeToggle />

            <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs text-slate-600 shadow-xs sm:flex dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ROLE_LABELS[role]}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {readOnly && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <Archive className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Periode arsip — hanya bisa dibaca.</p>
                <p className="mt-0.5 text-[13px]">
                  Data periode ini sudah selesai dan tidak bisa ditambah atau
                  diubah. Hubungi Super Admin bila diperlukan koreksi arsip.
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({
  profile,
  periods,
  allPeriodsMode,
  readOnly,
  selectedPeriodId,
  children,
}: {
  profile: Profile;
  periods: PeriodeOption[];
  allPeriodsMode: boolean;
  readOnly: boolean;
  selectedPeriodId: string | null;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <PeriodeProvider
        periodeId={selectedPeriodId}
        allPeriodsMode={allPeriodsMode}
        readOnly={readOnly}
        options={periods.map((p) => ({
          id: p.id,
          namaPeriode: p.namaPeriode,
          tahunMulai: p.tahunMulai,
          tahunSelesai: p.tahunSelesai,
          status: p.status,
        }))}
      >
        <ShellInner
          profile={profile}
          periods={periods}
          allPeriodsMode={allPeriodsMode}
          readOnly={readOnly}
          selectedPeriodId={selectedPeriodId}
        >
          {children}
        </ShellInner>
      </PeriodeProvider>
    </ToastProvider>
  );
}

