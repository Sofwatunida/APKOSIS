import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_STRUCTURE: NavSection[] = [
  {
    title: "Utama",
    items: [{ label: "Dashboard", href: "/dashboard", roles: ["division_admin", "monitoring", "sekretaris", "bendahara"] }],
  },
  {
    title: "Divisi",
    items: [
      { label: "Laporan Harian", href: "/dashboard/laporan", roles: ["division_admin"] },
      { label: "Anggota", href: "/dashboard/anggota", roles: ["division_admin"] },
      { label: "Program Kerja", href: "/dashboard/program-kerja", roles: ["division_admin", "monitoring", "sekretaris", "bendahara"] },
      { label: "Inventaris", href: "/dashboard/inventaris", roles: ["division_admin"] },
      { label: "Kebutuhan", href: "/dashboard/kebutuhan", roles: ["division_admin"] },
      { label: "Keuangan", href: "/dashboard/keuangan", roles: ["division_admin"] },
      { label: "Profil Divisi", href: "/dashboard/profil-divisi", roles: ["division_admin"] },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Semua Divisi", href: "/dashboard/monitoring/divisi", roles: ["monitoring"] },
      { label: "Laporan", href: "/dashboard/monitoring/laporan", roles: ["monitoring"] },
      { label: "Rekap & Kendala", href: "/dashboard/monitoring/rekap", roles: ["monitoring"] },
    ],
  },
  {
    title: "Administrasi",
    items: [
      { label: "Semua Divisi", href: "/dashboard/sekretaris/divisi", roles: ["sekretaris"] },
      { label: "Laporan", href: "/dashboard/sekretaris/laporan", roles: ["sekretaris"] },
      { label: "Rekap & Kendala", href: "/dashboard/sekretaris/rekap", roles: ["sekretaris"] },
      { label: "Export Excel", href: "/dashboard/sekretaris/export", roles: ["sekretaris"] },
    ],
  },
  {
    title: "Keuangan Pusat",
    items: [
      { label: "Transaksi", href: "/dashboard/bendahara/transaksi", roles: ["bendahara"] },
      { label: "Rekap Bulanan", href: "/dashboard/bendahara/rekap-bulanan", roles: ["bendahara"] },
      { label: "Rekap Tahunan", href: "/dashboard/bendahara/rekap-tahunan", roles: ["bendahara"] },
      { label: "Export Excel", href: "/dashboard/bendahara/export", roles: ["bendahara"] },
    ],
  },
];
