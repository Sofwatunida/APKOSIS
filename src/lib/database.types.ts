export type Role = "division_admin" | "monitoring" | "sekretaris" | "bendahara";

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
          status_pembelian: string;
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
          status_pembelian?: string;
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
          status_pembelian?: string;
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
      transaksi_keuangan: {
        Row: {
          id: string;
          divisi_id: string;
          laporan_id: string | null;
          tanggal: string;
          jenis_transaksi: "pemasukan" | "pengeluaran";
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
