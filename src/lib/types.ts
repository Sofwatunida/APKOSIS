import type { Database } from "./database.types";

export type Role = "division_admin" | "monitoring" | "sekretaris" | "bendahara";

export interface Profile {
  id: string;
  nama: string | null;
  email: string | null;
  role: Role | null;
  divisi_id: string | null;
  created_at: string;
  updated_at: string;
}

export type Divisi = Database["public"]["Tables"]["divisi"]["Row"];
export type AnggotaDivisi =
  Database["public"]["Tables"]["anggota_divisi"]["Row"];
export type ProgramKerja =
  Database["public"]["Tables"]["program_kerja"]["Row"];
export type LaporanHarian =
  Database["public"]["Tables"]["laporan_harian"]["Row"];
export type KendalaSolusi =
  Database["public"]["Tables"]["kendala_solusi"]["Row"];
export type Inventaris = Database["public"]["Tables"]["inventaris"]["Row"];
export type Kebutuhan = Database["public"]["Tables"]["kebutuhan"]["Row"];
export type TransaksiKeuangan =
  Database["public"]["Tables"]["transaksi_keuangan"]["Row"];

export type JenisTransaksi = "pemasukan" | "pengeluaran";
