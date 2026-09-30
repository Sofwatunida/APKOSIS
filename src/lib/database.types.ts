export type Role = "division_admin" | "monitoring" | "sekretaris" | "bendahara";

/** Status kebutuhan divisi - ditentukan oleh Bendahara. */
export type KebutuhanStatus =
  | "belum"
  | "disetujui"
  | "ditolak"
  | "sudah_dipenuhi";

/** Status persetujuan pengajuan dana - hanya diubah Bendahara. */
export type StatusPersetujuan = "belum" | "disetujui";

/** Status pengambilan uang pengajuan dana - hanya diubah Bendahara. */
export type StatusPengambilan = "belum" | "sudah_diambil";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nama: string | null;
          email: string | null;
          role: Role | null;
          divisi_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nama?: string | null;
          email?: string | null;
          role?: Role | null;
          divisi_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nama?: string | null;
          email?: string | null;
          role?: Role | null;
          divisi_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      divisi: {
        Row: {
          id: string;
          nomor_divisi: number;
          nama_divisi: string;
          ketua_divisi: string | null;
          wakil_divisi: string | null;
          periode: string | null;
          deskripsi: string | null;
          catatan_program_belum_terlaksana: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nomor_divisi: number;
          nama_divisi: string;
          ketua_divisi?: string | null;
          wakil_divisi?: string | null;
          periode?: string | null;
          deskripsi?: string | null;
          catatan_program_belum_terlaksana?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nomor_divisi?: number;
          nama_divisi?: string;
          ketua_divisi?: string | null;
          wakil_divisi?: string | null;
          periode?: string | null;
          deskripsi?: string | null;
          catatan_program_belum_terlaksana?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      anggota_divisi: {
        Row: {
          id: string;
          divisi_id: string;
          nama: string;
          jabatan: string | null;
          status: string;
          tanggal_masuk: string | null;
          tanggal_keluar: string | null;
          keterangan: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          nama: string;
          jabatan?: string | null;
          status?: string;
          tanggal_masuk?: string | null;
          tanggal_keluar?: string | null;
          keterangan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          nama?: string;
          jabatan?: string | null;
          status?: string;
          tanggal_masuk?: string | null;
          tanggal_keluar?: string | null;
          keterangan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anggota_divisi_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      program_kerja: {
        Row: {
          id: string;
          divisi_id: string;
          nama_program: string | null;
          deskripsi: string | null;
          file_name: string | null;
          file_path: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          nama_program?: string | null;
          deskripsi?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          nama_program?: string | null;
          deskripsi?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_kerja_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      laporan_harian: {
        Row: {
          id: string;
          divisi_id: string;
          tanggal: string;
          pelapor_id: string | null;
          kegiatan_hari_ini: string;
          informasi_lain: string | null;
          penerima_laporan: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          tanggal: string;
          pelapor_id?: string | null;
          kegiatan_hari_ini: string;
          informasi_lain?: string | null;
          penerima_laporan?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          tanggal?: string;
          pelapor_id?: string | null;
          kegiatan_hari_ini?: string;
          informasi_lain?: string | null;
          penerima_laporan?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "laporan_harian_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "laporan_harian_pelapor_id_fkey";
            columns: ["pelapor_id"];
            referencedRelation: "anggota_divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      kendala_solusi: {
        Row: {
          id: string;
          laporan_id: string;
          kendala: string;
          solusi: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          laporan_id: string;
          kendala: string;
          solusi: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          laporan_id?: string;
          kendala?: string;
          solusi?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kendala_solusi_laporan_id_fkey";
            columns: ["laporan_id"];
            referencedRelation: "laporan_harian";
            referencedColumns: ["id"];
          }
        ];
      };
      opsi_kegiatan: {
        Row: {
          id: string;
          divisi_id: string;
          nama_kegiatan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          nama_kegiatan: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          nama_kegiatan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opsi_kegiatan_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      inventaris: {
        Row: {
          id: string;
          divisi_id: string;
          nama_barang: string;
          jumlah: number | null;
          kondisi: string | null;
          keterangan: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          nama_barang: string;
          jumlah?: number | null;
          kondisi?: string | null;
          keterangan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          nama_barang?: string;
          jumlah?: number | null;
          kondisi?: string | null;
          keterangan?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventaris_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      kebutuhan: {
        Row: {
          id: string;
          divisi_id: string;
          laporan_id: string | null;
          nama_kebutuhan: string;
          jumlah: number | null;
          keterangan: string | null;
          status: KebutuhanStatus;
          tanggal: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          laporan_id?: string | null;
          nama_kebutuhan: string;
          jumlah?: number | null;
          keterangan?: string | null;
          status?: KebutuhanStatus;
          tanggal?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          laporan_id?: string | null;
          nama_kebutuhan?: string;
          jumlah?: number | null;
          keterangan?: string | null;
          status?: KebutuhanStatus;
          tanggal?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kebutuhan_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "kebutuhan_laporan_id_fkey";
            columns: ["laporan_id"];
            referencedRelation: "laporan_harian";
            referencedColumns: ["id"];
          }
        ];
      };
      pengajuan_dana: {
        Row: {
          id: string;
          divisi_id: string;
          user_id: string;
          kebutuhan_id: string | null;
          tanggal_pengajuan: string;
          nominal: number;
          keperluan: string;
          status_persetujuan: StatusPersetujuan;
          status_pengambilan: StatusPengambilan;
          approved_by: string | null;
          approved_at: string | null;
          taken_by: string | null;
          taken_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          user_id: string;
          kebutuhan_id?: string | null;
          tanggal_pengajuan: string;
          nominal: number;
          keperluan: string;
          status_persetujuan?: StatusPersetujuan;
          status_pengambilan?: StatusPengambilan;
          approved_by?: string | null;
          approved_at?: string | null;
          taken_by?: string | null;
          taken_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          user_id?: string;
          kebutuhan_id?: string | null;
          tanggal_pengajuan?: string;
          nominal?: number;
          keperluan?: string;
          status_persetujuan?: StatusPersetujuan;
          status_pengambilan?: StatusPengambilan;
          approved_by?: string | null;
          approved_at?: string | null;
          taken_by?: string | null;
          taken_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pengajuan_dana_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "pengajuan_dana_kebutuhan_id_fkey";
            columns: ["kebutuhan_id"];
            referencedRelation: "kebutuhan";
            referencedColumns: ["id"];
          }
        ];
      };
      saldo_awal: {
        Row: {
          id: number;
          nominal: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          nominal?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          nominal?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saldo_awal_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      transaksi_keuangan: {
        Row: {
          id: string;
          divisi_id: string;
          laporan_id: string | null;
          tanggal: string;
          jenis_transaksi: "pemasukan" | "pengeluaran";
          sumber_pemasukan: string | null;
          digunakan_untuk: string | null;
          keterangan: string;
          nominal: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          laporan_id?: string | null;
          tanggal: string;
          jenis_transaksi: "pemasukan" | "pengeluaran";
          sumber_pemasukan?: string | null;
          digunakan_untuk?: string | null;
          keterangan: string;
          nominal: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          laporan_id?: string | null;
          tanggal?: string;
          jenis_transaksi?: "pemasukan" | "pengeluaran";
          sumber_pemasukan?: string | null;
          digunakan_untuk?: string | null;
          keterangan?: string;
          nominal?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaksi_keuangan_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "transaksi_keuangan_laporan_id_fkey";
            columns: ["laporan_id"];
            referencedRelation: "laporan_harian";
            referencedColumns: ["id"],
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
