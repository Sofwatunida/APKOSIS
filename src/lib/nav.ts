import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
 
  { label: "Dashboard", href: "/dashboard/superadmin", roles: ["super_admin"] },
  { label: "Dashboard", href: "/dashboard/admin", roles: ["admin"] },
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["division_admin", "monitoring", "sekretaris", "bendahara"],
  },
  {
    label: "Kelola Periode",
    href: "/dashboard/superadmin/periode",
    roles: ["super_admin"],
  },
  {
    label: "Pengelolaan Akun ",
    href: "/dashboard/superadmin/akun",
    roles: ["super_admin"],
  },
  {
    label: "Log Aktivitas",
    href: "/dashboard/superadmin/audit",
    roles: ["super_admin"],
  },
  {
    label: "Cetak Laporan",
    href: "/dashboard/superadmin/laporan",
    roles: ["super_admin"],
  },
  {
    label: "Backup & Reset",
    href: "/dashboard/superadmin/backup",
    roles: ["super_admin"],
  },
  { label: "Ringkasan", href: "/dashboard/admin", roles: ["admin"] },
  {
    label: "Password Divisi",
    href: "/dashboard/admin/password-divisi",
    roles: ["admin"],
  },
  {
    label: "Kelola Divisi",
    href: "/dashboard/admin/divisi",
    roles: ["admin"],
  },
  {
    label: "Kontrol Program Kerja",
    href: "/dashboard/admin/program-kerja",
    roles: ["admin", "super_admin"],
  },
  { label: "Laporan Harian", href: "/dashboard/laporan", roles: ["division_admin"] },
  { label: "Anggota", href: "/dashboard/anggota", roles: ["division_admin"] },
  {
    label: "Program Kerja",
    href: "/dashboard/program-kerja",
    roles: ["division_admin", "monitoring", "sekretaris", "bendahara"],
  },
  { label: "Inventaris", href: "/dashboard/inventaris", roles: ["division_admin"] },
  { label: "Kebutuhan", href: "/dashboard/kebutuhan", roles: ["division_admin"] },
  {
    label: "Pengajuan Dana",
    href: "/dashboard/pengajuan-dana",
    roles: ["division_admin"],
  },
  { label: "Keuangan", href: "/dashboard/keuangan", roles: ["division_admin"] },
  {
    label: "Profil Divisi",
    href: "/dashboard/profil-divisi",
    roles: ["division_admin"],
  },
  {
    label: "Rekap Keuangan",
    href: "/dashboard/detail-keuangan",
    roles: ["bendahara"],
  },
  {
    label: "Semua Divisi",
    href: "/dashboard/monitoring/divisi",
    roles: ["monitoring"],
  },
  {
    label: "Laporan",
    href: "/dashboard/monitoring/laporan",
    roles: ["monitoring"],
  },
  {
    label: "Rekap Keuangan",
    href: "/dashboard/monitoring/rekap-keuangan",
    roles: ["monitoring"],
  },
  {
    label: "Rekap Kendala",
    href: "/dashboard/monitoring/rekap-kendala",
    roles: ["monitoring"],
  },
  {
    label: "Semua Divisi",
    href: "/dashboard/sekretaris/divisi",
    roles: ["sekretaris"],
  },
  {
    label: "Laporan",
    href: "/dashboard/sekretaris/laporan",
    roles: ["sekretaris"],
  },
  {
    label: "Rekap Keuangan",
    href: "/dashboard/sekretaris/rekap-keuangan",
    roles: ["sekretaris"],
  },
  {
    label: "Rekap Kendala",
    href: "/dashboard/sekretaris/rekap-kendala",
    roles: ["sekretaris"],
  },
  {
    label: "Transaksi",
    href: "/dashboard/bendahara/transaksi",
    roles: ["bendahara"],
  },
  {
    label: "Kebutuhan Divisi",
    href: "/dashboard/bendahara/kebutuhan-divisi",
    roles: ["bendahara"],
  },
  {
    label: "Pengajuan Dana",
    href: "/dashboard/bendahara/pengajuan-dana",
    roles: ["bendahara"],
  },
  {
    label: "Rekap Bulanan",
    href: "/dashboard/bendahara/rekap-bulanan",
    roles: ["bendahara"],
  },
  {
    label: "Rekap Tahunan",
    href: "/dashboard/bendahara/rekap-tahunan",
    roles: ["bendahara"],
  },
];
