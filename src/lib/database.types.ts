export type Role = "super_admin" | "admin" | "division_admin" | "monitoring" | "sekretaris" | "bendahara";

export type PeriodStatus = "active" | "archived" | "inactive";

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
          periode_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nama?: string | null;
          email?: string | null;
          role?: Role | null;
          divisi_id?: string | null;
          periode_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nama?: string | null;
          email?: string | null;
          role?: Role | null;
          divisi_id?: string | null;
          periode_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
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
          periode_id: string | null;
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
          periode_id?: string | null;
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
          periode_id?: string | null;
          deskripsi?: string | null;
          catatan_program_belum_terlaksana?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "divisi_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      anggota_divisi: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
          },
          {
            foreignKeyName: "anggota_divisi_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      program_kerja: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
          },
          {
            foreignKeyName: "program_kerja_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      laporan_harian: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
          },
          {
            foreignKeyName: "laporan_harian_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      kendala_solusi: {
        Row: {
          id: string;
          laporan_id: string;
          periode_id: string;
          kendala: string;
          solusi: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          laporan_id: string;
          periode_id?: string;
          kendala: string;
          solusi: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          laporan_id?: string;
          periode_id?: string;
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
          },
          {
            foreignKeyName: "kendala_solusi_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      opsi_kegiatan: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
          nama_kegiatan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          divisi_id: string;
          periode_id?: string;
          nama_kegiatan: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          divisi_id?: string;
          periode_id?: string;
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
          },
          {
            foreignKeyName: "opsi_kegiatan_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      inventaris: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
          },
          {
            foreignKeyName: "inventaris_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      kebutuhan: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
          },
          {
            foreignKeyName: "kebutuhan_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      pengajuan_dana: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pengajuan_dana_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
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
          periode_id: string;
          nominal: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          periode_id?: string;
          nominal?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          periode_id?: string;
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
          },
          {
            foreignKeyName: "saldo_awal_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      transaksi_keuangan: {
        Row: {
          id: string;
          divisi_id: string;
          periode_id: string;
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
          periode_id?: string;
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
          periode_id?: string;
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
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaksi_keuangan_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
{
            foreignKeyName: "transaksi_keuangan_laporan_id_fkey";
            columns: ["laporan_id"];
            referencedRelation: "laporan_harian";
            referencedColumns: ["id"];
          }
        ];
      };
      division_credentials: {
        Row: {
          divisi_id: string;
          periode_id: string;
          password_hash: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          divisi_id: string;
          periode_id?: string;
          password_hash: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          divisi_id?: string;
          periode_id?: string;
          password_hash?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "division_credentials_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "division_credentials_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
      division_sessions: {
        Row: {
          token: string;
          user_id: string;
          divisi_id: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          token?: string;
          user_id: string;
          divisi_id: string;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          token?: string;
          user_id?: string;
          divisi_id?: string;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "division_sessions_divisi_id_fkey";
            columns: ["divisi_id"];
            referencedRelation: "divisi";
            referencedColumns: ["id"];
          }
        ];
      };
      periods: {
        Row: {
          id: string;
          nama_periode: string;
          tahun_mulai: number;
          tahun_selesai: number;
          status: PeriodStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nama_periode: string;
          tahun_mulai: number;
          tahun_selesai: number;
          status?: PeriodStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nama_periode?: string;
          tahun_mulai?: number;
          tahun_selesai?: number;
          status?: PeriodStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_periods: {
        Row: {
          id: string;
          admin_id: string;
          periode_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          periode_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          periode_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_periods_admin_id_fkey";
            columns: ["admin_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_periods_periode_id_fkey";
            columns: ["periode_id"];
            referencedRelation: "periods";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      division_session_token: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      verify_division_password: {
        Args: { p_divisi_id: string; p_password: string };
        Returns: boolean;
      };
      start_division_session: {
        Args: { p_divisi_id: string; p_password: string };
        Returns: string;
      };
      end_division_session: {
        Args: { p_token: string };
        Returns: undefined;
      };
      set_division_password: {
        Args: { p_divisi_id: string; p_password: string };
        Returns: string;
      };
      division_crypto_search_path: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      division_credential_status: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          divisi_id: string;
          nomor_divisi: number;
          nama_divisi: string;
          has_password: boolean;
          updated_at: string | null;
        }>;
      };
      get_active_period_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      get_periods_for_dropdown: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          id: string;
          nama_periode: string;
          tahun_mulai: number;
          tahun_selesai: number;
          status: PeriodStatus;
        }>;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      current_role: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_admin: {
        Args: { p_period_id?: string | null };
        Returns: boolean;
      };
      current_periode_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      can_access_period: {
        Args: { p_period_id: string };
        Returns: boolean;
      };
      is_period_writable: {
        Args: { p_period_id: string | null };
        Returns: boolean;
      };
      admin_period_create: {
        Args: {
          p_nama_periode: string;
          p_tahun_mulai: number;
          p_tahun_selesai: number;
        };
        Returns: string;
      };
      admin_period_activate: {
        Args: { p_periode_id: string };
        Returns: string;
      };
      admin_period_archive: {
        Args: { p_periode_id: string };
        Returns: string;
      };
      admin_period_update: {
        Args: {
          p_periode_id: string;
          p_nama_periode?: string | null;
          p_tahun_mulai?: number | null;
          p_tahun_selesai?: number | null;
        };
        Returns: undefined;
      };
      admin_period_list_all: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          id: string;
          nama_periode: string;
          tahun_mulai: number;
          tahun_selesai: number;
          status: PeriodStatus;
          jumlah_laporan: number;
          jumlah_transaksi: number;
          jumlah_anggota: number;
          created_at: string;
        }>;
      };      admin_accounts_list: {
        Args: { p_periode_id?: string | null };
        Returns: Array<{
          id: string;
          nama: string | null;
          email: string | null;
          role: string | null;
          periode_id: string | null;
          assigned_at: string | null;
        }>;
      };
      admin_assign_period: {
        Args: { p_user_id: string; p_periode_id: string | null };
        Returns: undefined;
      };
      admin_set_user_role: {
        Args: { p_user_id: string; p_role: string };
        Returns: undefined;
      };
      admin_set_division_password: {
        Args: { p_divisi_id: string; p_password: string; p_periode_id?: string | null };
        Returns: string;
      };
      admin_division_credential_status: {
        Args: { p_periode_id?: string | null };
        Returns: Array<{
          divisi_id: string;
          nomor_divisi: number;
          nama_divisi: string;
          has_password: boolean;
          updated_at: string | null;
        }>;
      };
      admin_division_account_list: {
        Args: { p_periode_id?: string | null };
        Returns: Array<{
          divisi_id: string;
          nomor_divisi: number;
          nama_divisi: string;
          account_count: number;
          has_password: boolean;
          updated_at: string | null;
        }>;
      };
      admin_divisi_set_period: {
        Args: { p_divisi_id: string; p_periode_id: string | null };
        Returns: undefined;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}
