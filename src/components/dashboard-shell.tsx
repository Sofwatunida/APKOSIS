"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearDivisionTokenCookie } from "@/lib/division-session-client";
import { endDivisionSessionAction } from "@/app/pilih-divisi/actions";
import { PeriodeProvider } from "@/lib/periode-context";
import { NAV_ITEMS } from "@/lib/nav";
import type { PeriodeOption } from "@/lib/period";
import type { Profile, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/role";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { PeriodePicker } from "@/components/periode-picker";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  Banknote,
  Boxes,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coins,
  Database,
  FileSearch,
  FileText,
  FolderKanban,
  Gauge,
  HandCoins,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Network,
  Package,
  Printer,
  ReceiptText,
  ScrollText,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UserCog,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { RealtimeClock } from "@/components/realtime-clock";
import { stopImpersonationAction } from "@/app/dashboard/actions/impersonation-actions";

/**
 * Ikon eksplisit per href. Jangan memakai pencocokan substring: beberapa
 * fitur berbagi kata (mis. "laporan", "divisi", "keuangan") sehingga ikon
 * lama bisa sama. Setiap fitur di sidebar harus punya ikon berbeda.
 */
const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/superadmin": ShieldCheck,
  "/dashboard/superadmin/periode": CalendarRange,
  "/dashboard/superadmin/akun": UserCog,
  "/dashboard/superadmin/audit": ScrollText,
  "/dashboard/superadmin/laporan": Printer,
  "/dashboard/superadmin/backup": Database,
  "/dashboard/admin": Gauge,
  "/dashboard/admin/password-divisi": KeyRound,
  "/dashboard/admin/program-kerja": ListChecks,
  "/dashboard/laporan": ClipboardList,
  "/dashboard/anggota": UsersRound,
  "/dashboard/program-kerja": FolderKanban,
  "/dashboard/inventaris": Package,
  "/dashboard/kebutuhan": ShoppingBag,
  "/dashboard/pengajuan-dana": HandCoins,
  "/dashboard/keuangan": Wallet,
  "/dashboard/profil-divisi": Building2,
  "/dashboard/detail-keuangan": Coins,
  "/dashboard/monitoring/divisi": Network,
  "/dashboard/monitoring/laporan": FileSearch,
  "/dashboard/monitoring/rekap-keuangan": Banknote,
  "/dashboard/monitoring/rekap-kendala": AlertCircle,
  "/dashboard/sekretaris/divisi": Boxes,
  "/dashboard/sekretaris/laporan": FileText,
  "/dashboard/sekretaris/rekap-keuangan": ReceiptText,
  "/dashboard/sekretaris/rekap-kendala": AlertTriangle,
  "/dashboard/bendahara/transaksi": ArrowLeftRight,
  "/dashboard/bendahara/kebutuhan-divisi": ShoppingCart,
  "/dashboard/bendahara/pengajuan-dana": Send,
  "/dashboard/bendahara/rekap-bulanan": CalendarDays,
  "/dashboard/bendahara/rekap-tahunan": CalendarCheck2,
};

function getNavIcon(href: string) {
  return NAV_ICONS[href] ?? CircleHelp;
}

/** State Mode Penyamaran yang diteruskan dari server ke shell. */
interface ImpersonationState {
  role: Role;
  divisiId: string | null;
  accountId?: string | null;
  accountName?: string | null;
  startedAt: string;
}

function StopImpersonationSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 shadow-xs transition hover:bg-amber-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {pending ? "Memulihkan..." : "Kembali ke Super Admin"}
      </span>
      <span className="sm:hidden">{pending ? "Memulihkan..." : "Kembali"}</span>
    </button>
  );
}

function ShellInner({
  profile,
  periods,
  allPeriodsMode,
  readOnly,
  canChangePeriod,
  selectedPeriodId,
  impersonation,
  children,
}: {
  profile: Profile;
  periods: PeriodeOption[];
  allPeriodsMode: boolean;
  readOnly: boolean;
  canChangePeriod: boolean;
  selectedPeriodId: string | null;
  impersonation: ImpersonationState | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Indikator perpindahan halaman. Navigasi App Router menunggu server,
  // jadi beri umpan balik visual segera setelah link internal diklik.
  const [navigating, setNavigating] = useState(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sidebar bisa diciutkan agar konten lebih lega. State disimpan di
  // localStorage supaya konsisten antar halaman. Default: terbuka (expanded),
  // sehingga tampilan role lain tidak berubah sama sekali.
  const [collapsed, setCollapsed] = useState(false);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--apkosis-header-offset",
        `${el.getBoundingClientRect().height}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [impersonation]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("apkosis-sidebar") === "collapsed") {
        setCollapsed(true);
      }
    } catch {
      /* localStorage tidak tersedia — abaikan. */
    }
  }, []);

  useEffect(() => {
    function clearTimer() {
      if (navTimer.current) {
        clearTimeout(navTimer.current);
        navTimer.current = null;
      }
    }

    function handleInternalNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      setNavigating(true);
      clearTimer();
      // Pengaman bila navigasi dibatalkan atau gagal tanpa perubahan path.
      navTimer.current = setTimeout(() => setNavigating(false), 8000);
    }

    document.addEventListener("click", handleInternalNavigation, true);
    return () => {
      document.removeEventListener("click", handleInternalNavigation, true);
      clearTimer();
    };
  }, []);

  useEffect(() => {
    setNavigating(false);
    if (navTimer.current) {
      clearTimeout(navTimer.current);
      navTimer.current = null;
    }
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(
          "apkosis-sidebar",
          next ? "collapsed" : "expanded"
        );
      } catch {
        /* abaikan */
      }
      return next;
    });
  }

  const role = profile.role ?? "division_admin";

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Kumpulkan href semua menu yang terlihat untuk menentukan menu aktif.
  const allHrefs = navItems.map((item) => item.href);

  /**
   * Menu aktif = href paling spesifik (terpanjang) yang cocok dengan path
   * saat ini. Tanpa ini, `/dashboard/superadmin/periode` membuat BOTH
   * "Dashboard" (`/dashboard/superadmin`) DAN "Kelola Periode"
   * aktif sekaligus — menimbulkan menu ganda.
   */
  const activeHref = allHrefs
    .filter((href) => {
      if (href === "/dashboard") return pathname === "/dashboard";
      return pathname === href || pathname.startsWith(href + "/");
    })
    .sort((a, b) => b.length - a.length)[0];

  async function handleLogout() {
    clearDivisionTokenCookie();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  /**
   * Keluar khusus role ketua/wakil divisi (division_admin): tutup sesi divisi
   * lalu kembali ke /pilih-divisi supaya bisa memilih divisi lain.
   * Akun tetap login, sehingga pindah divisi tidak perlu login ulang.
   */
  async function handleKeluarDivisi() {
    await endDivisionSessionAction();
    router.push("/pilih-divisi");
    router.refresh();
  }

  function isActive(href: string) {
    if (!activeHref) return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
    // Hindari highlight ganda: jika ada yang lebih spesifik, yang lain non-aktif.
    if (href === "/dashboard" && activeHref === "/dashboard") return pathname === "/dashboard";
    if (href !== "/dashboard" && activeHref.startsWith(href) && activeHref.length === href.length) return true;
    if (href !== "/dashboard" && activeHref === href) return true;
    return false;
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

  const buildSidebar = (
    v: boolean,
    options?: { onClose?: () => void }
  ) => (
    <div className="sidebar-surface flex h-full flex-col overflow-hidden">
      {/* Bagian atas: brand + menu navigasi (menu panjang discroll sendiri) */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Brand Header - identitas hanya tulisan "APKOSIS", tanpa logo/icon tambahan.
            Toggle sidebar berada di tepi sidebar desktop, bukan di header ini. */}
        <div
          className={`flex shrink-0 items-center border-b border-slate-200/80 dark:border-slate-800/80 ${
            v
              ? "flex-col justify-center gap-1.5 px-2 py-2.5"
              : "h-16 justify-between gap-2 px-5"
          }`}
        >
          <Link
            href="/dashboard"
            prefetch
            className={`group flex min-w-0 flex-col justify-center ${v ? "items-center" : ""}`}
          >
            {v ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-sm font-extrabold text-white shadow-xs">
                A
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="sidebar-brand-text text-xl font-extrabold leading-none tracking-[-0.02em]">
                    APKOSIS
                  </span>
                  <span className="rounded-md border border-brand-500/20 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-400">
                    {activePeriodBadge}
                  </span>
                </div>
              </>
            )}
          </Link>

          {options?.onClose && (
            <button
              type="button"
              onClick={options.onClose}
              className="tap-target inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation — satu daftar menu tanpa label grup. `min-h-0` + `flex-1`
            membuat nav tetap bisa discroll tanpa mendorong kartu user keluar layar. */}
        <nav className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-5 ${v ? "px-2.5" : "px-3.5"}`}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const IconComponent = getNavIcon(item.href);
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    title={v ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onFocus={() => router.prefetch(item.href)}
                    className={`group flex items-center rounded-xl py-2.5 text-xs font-medium transition-all duration-150 ${
                      v ? "justify-center px-2" : "gap-3 px-3"
                    } ${active ? "sidebar-link-active font-semibold" : "sidebar-link"}`}
                  >
                    <IconComponent
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200"
                      }`}
                    />
                    {!v && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* User Info & Logout — `shrink-0` agar selalu menempel di dasar
          sidebar (tidak ikut terdorong keluar layar saat menu panjang). */}
      <div className={`shrink-0 border-t border-slate-200/80 p-3 dark:border-slate-800/80 ${v ? "flex flex-col items-center gap-2" : ""}`}>
        <div className={`sidebar-user-card flex items-center rounded-xl border p-2.5 ${v ? "justify-center gap-0" : "gap-3"}`}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-xs">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          {!v && (
            <div className="min-w-0 flex-1">
              <p className="sidebar-brand-text truncate text-xs font-semibold">
                {displayName}
              </p>
              <p className="sidebar-subtle truncate text-[11px]">{ROLE_LABELS[role]}</p>
            </div>
          )}
          {!v && role === "division_admin" && !impersonation && (
            <button
              onClick={handleKeluarDivisi}
              title="Keluar & pilih divisi lain"
              aria-label="Keluar & pilih divisi lain"
              className="tap-target rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tombol Keluar di paling bawah untuk role selain ketua/wakil divisi
            (Bendahara, Sekretaris, Monitoring, Admin, Super Admin) — dan juga
            tampil saat Mode Penyamaran sebagai Admin Divisi, supaya footer
            sidebar tetap punya tombol keluar. Memakai sistem logout yang
            sama: hapus sesi divisi + signOut + ke /login. */}
        {(role !== "division_admin" || impersonation) && (
          <button
            onClick={handleLogout}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-600 shadow-xs transition hover:bg-rose-100 active:scale-[0.99] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 ${v ? "mt-0 p-2" : "mt-2.5 px-3 py-2"}`}
            title={v ? "Keluar" : undefined}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!v && <span>Keluar</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50 dark:bg-slate-950">
      {navigating && (
        <div
          role="progressbar"
          aria-label="Memuat halaman"
          className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-950"
        >
          <div className="h-full w-1/3 animate-nav-progress bg-brand-600 dark:bg-brand-400" />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden lg:block transition-[width] duration-300 border-r shadow-card dark:shadow-elevated ${collapsed ? "w-16" : "w-64"}`}>
        {buildSidebar(collapsed)}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute right-0 top-1/2 z-40 hidden h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full text-slate-400 transition-all duration-300 hover:bg-slate-100/80 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 lg:flex dark:text-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
          aria-label={collapsed ? "Tampilkan Sidebar" : "Sembunyikan Sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Tampilkan Sidebar" : "Sembunyikan Sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 max-w-[calc(100vw-3rem)] border-r shadow-2xl animate-slide-up">
            {buildSidebar(false, { onClose: () => setMobileOpen(false) })}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`min-w-0 transition-[padding-left] duration-300 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {/* Sticky Top Header — banner Mode Penyamaran (jika aktif) ikut
            menempel di atas, supaya indikator "MODE PENYAMARAN AKTIF"
            selalu terlihat di setiap halaman. */}
        <div ref={stickyRef} className="sticky top-0 z-20">
          {impersonation && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 lg:px-8 dark:border-amber-500/40 dark:bg-amber-950/70">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Mode Penyamaran Aktif
                </span>
                <span className="min-w-0 break-words text-amber-800 dark:text-amber-300">
                  <span className="hidden sm:inline">Anda sedang melihat sistem sebagai </span>
                  <strong>
                    {impersonation.accountName
                      ? `${impersonation.accountName} (${ROLE_LABELS[impersonation.role]})`
                      : ROLE_LABELS[impersonation.role]}
                  </strong>
                </span>
              </div>
              <form action={stopImpersonationAction}>
                <StopImpersonationSubmit />
              </form>
            </div>
          )}
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200/80 bg-white/85 px-4 py-2 backdrop-blur-md lg:px-8 dark:border-slate-800/80 dark:bg-slate-900/85">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="tap-target rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{formattedDate}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
            <RealtimeClock className="hidden sm:inline-flex" />
            <PeriodePicker
              canSelectAllPeriods={profile.role === "super_admin"}
              canChange={canChangePeriod}
            />
            <ThemeToggle />

            <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs text-slate-600 shadow-xs sm:flex dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ROLE_LABELS[role]}</span>
            </div>

            {/* Tombol Keluar khusus ketua/wakil divisi: kembali ke
                /pilih-divisi untuk memilih divisi lain. Disembunyikan saat
                Mode Penyamaran — divisi tujuan sudah ditentukan cookie. */}
            {role === "division_admin" && !impersonation && (
              <button
                onClick={handleKeluarDivisi}
                title="Keluar & pilih divisi lain"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 shadow-xs transition hover:bg-rose-100 active:scale-[0.98] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 sm:min-h-0"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            )}

            {(role !== "division_admin" || impersonation) && (
              <button
                onClick={handleLogout}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:min-h-0 lg:hidden"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
          </header>
        </div>

        {/* Content Body
            `min-w-0` + `overflow-x-clip` menjaga tabel/konten lebar tetap
            bisa digeser di dalam container-nya sendiri, bukan memaksa seluruh
            halaman melebar keluar viewport. */}
        <main className="page-body mx-auto w-full min-w-0 max-w-7xl overflow-x-clip p-4 sm:p-6 lg:p-8">
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
  canChangePeriod,
  selectedPeriodId,
  impersonation = null,
  children,
}: {
  profile: Profile;
  periods: PeriodeOption[];
  allPeriodsMode: boolean;
  readOnly: boolean;
  canChangePeriod: boolean;
  selectedPeriodId: string | null;
  impersonation?: ImpersonationState | null;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <PeriodeProvider
        periodeId={selectedPeriodId}
        allPeriodsMode={allPeriodsMode}
        readOnly={readOnly}
        canChangePeriod={canChangePeriod}
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
          canChangePeriod={canChangePeriod}
          selectedPeriodId={selectedPeriodId}
          impersonation={impersonation}
        >
          {children}
        </ShellInner>
      </PeriodeProvider>
    </ToastProvider>
  );
}

