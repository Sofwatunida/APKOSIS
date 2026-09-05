# APKOSIS — Aplikasi Laporan Harian OSIS

Aplikasi full-stack untuk mengelola laporan harian dari 20 divisi OSIS. Dibangun dengan **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase**, **Recharts**, dan **ExcelJS** untuk export Excel.

## Fitur

- **Login & Autentikasi** via Supabase Auth (email & password)
- **4 Peran pengguna** (role):
  - `division_admin` — Admin untuk 20 divisi (laporan, anggota, keuangan, inventaris, kebutuhan, program kerja, profil divisi)
  - `monitoring` — Memantau status laporan & rekap seluruh divisi
  - `sekretaris` — Melihat seluruh divisi, laporan, rekap, dan export Excel administrasi
  - `bendahara` — Mengelola & merekap keuangan (transaksi, rekap bulanan/tahunan, export)
- **Laporan Harian** dengan kendala & solusi
- **Keuangan** (pemasukan/pengeluaran/saldo) + grafik rekap bulanan & tahunan
- **Inventaris, Kebutuhan, Anggota, Program Kerja** (unggah file ke Storage)
- **Export Excel** otomatis (administrasi & keuangan)
- **RLS (Row Level Security)** di semua tabel
- UI responsif (mobile drawer + sidebar)

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Framework | Next.js 15 (App Router, Server & Client Components) |
| Bahasa | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL + Auth + Storage) |
| Grafik | Recharts |
| Export Excel | ExcelJS |

## Instalasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Variabel Lingkungan (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://mqqpjcgynwzlrqjimbkg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_u7yBMUyIlHjaGF_Dv3ELYA_Lj783nxS
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` juga didukung sebagai fallback. Jangan pernah menyimpan kunci *service role* di kode.

## Setup Database (PENTING)

Proyek ini menggunakan Supabase project yang sudah ada: **`mqqpjcgynwzlrqjimbkg`** (tidak membuat project baru).

Tabel & kebijakan masih perlu dibuat. Jalankan SQL berikut di **Supabase Dashboard → SQL Editor**:

```
supabase/migrations/20260101000000_initial_schema.sql
```

File tersebut berisi:
1. Pembuatan 9 tabel (`profiles`, `divisi`, `anggota_divisi`, `program_kerja`, `laporan_harian`, `kendala_solusi`, `inventaris`, `kebutuhan`, `transaksi_keuangan`)
2. Trigger otomatis pembuatan `profiles` saat user mendaftar
3. Fungsi & RLS sesuai peran
4. Storage bucket `program-kerja` + kebijakannya
5. Seed 20 divisi OSIS

Setelah menjalankan migrasi, buat akun user di **Authentication → Users** dan tetapkan kolom `role` + `divisi_id` pada tabel `profiles` sesuai perannya.

> Karena hanya menggunakan *publishable key* (client-safe), skema tidak bisa dibuat lewat kode. Migrasi wajib dijalankan manual sekali lewat SQL Editor.

## Struktur

```
src/
├─ app/
│  ├─ api/export/            # API route export Excel (administrasi & keuangan)
│  └─ dashboard/             # Halaman-halaman peran
│     ├─ monitoring/         # divisi, laporan, rekap
│     ├─ sekretaris/         # divisi, laporan, rekap, export
│     └─ bendahara/          # transaksi, rekap-bulanan, rekap-tahunan, export
│     ├─ laporan/ anggota/ keuangan/ inventaris/ kebutuhan/
│     ├─ program-kerja/ profil-divisi/
├─ components/               # UI (button, card, form, modal, toast, shell, dll)
└─ lib/
   ├─ supabase/              # client, server, middleware
   ├─ database.types.ts      # tipe Database Supabase
   ├─ export.ts              # builder workbook Excel
   └─ format.ts, date.ts, role.ts, nav.ts, guard.ts, auth.ts
```

## Skrip

```bash
npm run dev        # development
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## Catatan

- Aplikasi membutuhkan tabel yang sudah dibuat (lihat Setup Database) sebelum berfungsi penuh.
- Akun 20 divisi mengikuti pola email di prompt (mis. `keamanan.apkosis2627@gmail.com`); buat akun dan set `role=division_admin` + `divisi_id` yang sesuai.
