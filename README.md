# APKOSIS — Sistem Laporan & Periode OSIS

Aplikasi full-stack untuk mengelola laporan harian divisi OSIS dengan
**sistem periode** dan **hierarki Super Admin → Admin → Divisi**.
Dibangun dengan **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**,
**Supabase**, **Recharts**, dan **ExcelJS**.

## Konsep Inti

```
SUPER ADMIN          → pemilik sistem, akses seluruh periode
        ↓
ADMIN                → pengelola operasional SATU periode
        ↓
DIVISI               → operational harian (laporan, keuangan, dst.)
```

Aturan yang dipegang sistem ini:

- Otorisasi selalu mempertimbangkan **role + periode**, bukan role saja.
- Data antar periode **tidak pernah tercampur**, dan pemisahan itu
  dijaga di **database (RLS + trigger)**, bukan hanya di tampilan.
- Perpindahan kepengurusan **tidak mereset database**. Periode lama
  diarsipkan, periode baru diaktifkan.
- Admin periode baru **tidak** mewarisi periode lama secara otomatis.

## Peran (Role)

| Role | Tugas | Halaman |
|------|-------|---------|
| `super_admin` | Kendali seluruh periode, akun, dan konfigurasi | `/dashboard/superadmin` |
| `admin` | Operasional satu periode yang ditugaskan | `/dashboard/admin` |
| `division_admin` | Operasional harian sebuah divisi | `/dashboard/laporan` dll |
| `monitoring` | Pantau laporan seluruh divisi | `/dashboard/monitoring/*` |
| `bendahara` | Transaksi dan rekap keuangan | `/dashboard/bendahara/*` |
| `sekretaris` | Dokumentasi dan rekap administrasi | `/dashboard/sekretaris/*` |

Super Admin **tidak** diberi halaman operasional divisi, dan role divisi
**tidak** diberi halaman Super Admin / Admin.

## Sistem Periode

Tabel `periods` menyimpan seluruh periode:

| Status | Arti | Boleh ditulis? |
|--------|------|----------------|
| `active` | Periode berjalan | Ya |
| `archived` | Periode selesai | Hanya Super Admin (koreksi arsip) |
| `inactive` | Sudah dibuat, belum dipakai | Hanya Super Admin |

Semua tabel operasional memakai `periode_id` dan **otomatis** difilter:

`laporan_harian`, `kendala_solusi`, `transaksi_keuangan`, `saldo_awal`,
`kebutuhan`, `pengajuan_dana`, `inventaris`, `program_kerja`,
`anggota_divisi`, `opsi_kegiatan`, `divisi`.

### Cara kerja period scope

1. Periode terpilih disimpan di cookie `apkosis_periode`, dibaca oleh
   Server Component maupun Client Component.
2. `src/lib/supabase/client.ts` dan `server.ts` membungkus `.from()` sehingga
   setiap query otomatis diberi `periode_id`, dan setiap `insert`/`update`/
   `upsert` otomatis mengisi `periode_id`.
3. `semua-periode` hanya untuk `super_admin` dan hanya untuk **membaca**.
4. Tanpa cookie, sistem memakai periode aktif, bukan tahun kalender.
5. Nilai cookie selalu divalidasi ulang ke `periods`; cookie basi tidak
   membuat halaman kosong tanpa penjelasan.

Konsekuensinya: tidak ada halaman yang bisa menampilkan data periode lain
karena lupa menulis filter.

### Sumber tunggal periode

`getPeriods()` / `getPeriodeContext()` di `src/lib/period.ts` adalah satu-
satu sumber daftar periode. **Jangan pernah membuat daftar tahun hardcoded**,
termasuk di dropdown.

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Bahasa | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL + Auth + Storage) |
| Grafik | Recharts |
| Export | ExcelJS (PDF/DOC/XLSX) |

## Instalasi

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Variabel Lingkungan (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` didukung sebagai fallback.
**Jangan pernah** meletakkan kunci *service role* di kode atau `.env.local`
yang ikut ter-deploy ke browser.

## Setup Database

Project memakai Supabase yang sudah ada; skema tidak dapat dibuat dari kode
karena hanya memakai *publishable key*. Jalankan migration berurutan di
**Supabase Dashboard → SQL Editor** atau lewat `supabase db push`:

```
20260101000000_initial_schema.sql            # tabel & RLS dasar
20260102000000_program_unggulan_bendahara.sql
20260103000000_saldo_awal_note_program.sql
20260104000000_opsi_kegiatan.sql
20260105000000_bukti_struk_bucket.sql
20260106000000_program_kerja_bendahara.sql
20260107000000_kebutuhan_divisi_status.sql
20260108000000_pengajuan_dana.sql
20260109000000_transaksi_keuangan_rincian.sql
20260110000000_division_admin_shared_login.sql
20260111000000_division_password_settings.sql
20260112000000_fix_pgcrypto_and_rpc_acl.sql
20260113000000_password_security_followup.sql
20261001000000_periods_system.sql            # Phase 2: tabel periods + periode_id
20261001000001_roles_admin_periods.sql       # Phase 3: role baru + admin_periods
20261001000002_rls_authorization_periods.sql # Phase 9 & 10: RLS, RPC, arsip
20261001000003_fix_profiles_policy_recursion.sql # Wajib: hentikan infinite recursion policy
20261001000004_fix_division_credential.sql      # Wajib: perbaiki simpan password + periode divisi
20261001000005_drop_ambiguous_periode_refs.sql   # Wajib: hapus overload liar + qualification periode_id
```

> **WAJIB dijalankan setelah `20261001000002`.** Tanpa migration ini semua
> query ke `profiles` (termasuk saat login) gagal dengan
> `42P17 infinite recursion detected in policy for relation "profiles"`,
> sehingga dashboard selalu menampilkan "Akun belum dikonfigurasi" meskipun
> `role` sudah terisi. Penyebabnya: beberapa policy menunjuk `profiles`
> secara langsung sehingga membentuk siklus policy.

> **WAJIB dijalankan setelah `20261001000003`.** Tanpa migration ini password
> divisi yang baru disimpan tidak bisa dipakai untuk login (password lama
> masih berlaku), dan status di "Super Admin > Kelola Akun" selalu
> "Belum ada password". Penyebabnya: `verify_division_password()` membaca
> hash tanpa batas periode, dan `admin_division_account_list()` memakai
> `left join ... on dc.periode_id = p_periode_id` yang selalu false saat
> `p_periode_id` bernilai `null`.

> **WAJIB dijalankan setelah `20261001000004`.** Tanpa migration ini setiap
> kartu divisi di "Super Admin > Kelola Akun" gagal dengan
> `42703 column reference "periode_id" is ambiguous`. Semua referensi
> `periode_id` di file SQL repo ini sudah beralias, jadi penyebabnya ada di
> database: **overload lama** dari salah satu fungsi RPC. PostgREST memilih
> overload berdasarkan nama argumen, dan
> `drop function if exists public.f(uuid)` hanya menghapus satu signature.
> Migration ini menghapus semua overload liar lalu membuat ulang rantainya
> dengan parameter `p_*` dan seluruh referensi kolom beralias.
>
> Kalau setelah menjalankan migration ini error masih muncul, jalankan
> `supabase/diagnose_periode_ambiguous.sql` (read-only) di SQL Editor dan
> kirim outputnya. Bagian **G** langsung menjalankan tiap RPC dan memberi
> tahu baris mana yang gagal.

### Membuat Super Admin pertama

```sql
update public.profiles
set role = 'super_admin'
where email = 'email-anda@example.com';
```

Lalu jalankan ulang salah satu query verifikasi di
`docs/TESTING_ROLE_PERIODE.md`.

## Struktur

```
src/
├─ app/
│  ├─ dashboard/
│  │  ├─ superadmin/        # periode, akun, divisi (super admin)
│  │  ├─ admin/             # ringkasan, password divisi, divisi
│  │  ├─ monitoring/ sekretaris/ bendahara/
│  │  └─ laporan/ anggota/ keuangan/ inventaris/ kebutuhan/ ...
│  └─ dashboard/actions/    # server action periode & akun
├─ components/              # UI + app-shell, periode-picker, export-menu
└─ lib/
   ├─ period.ts             # sumber tunggal periode
   ├─ period-scope.ts       # auto-filter periode untuk query
   ├─ periode-context.tsx   # provider + dropdown state
   ├─ period-constants.ts   # cookie, tabel periode, status
   ├─ supabase/             # client, server, middleware
   ├─ guard.ts role.ts nav.ts auth.ts
   └─ database.types.ts
```

## Pengujian

```bash
npm run verify        # typecheck + uji period scope + cocokkan RPC vs SQL
npm run verify:period # hanya uji isolasi periode (23 pemeriksaan)
npm run verify:rpc    # hanya cocokkan tanda tangan RPC SQL vs TypeScript
```

Pemeriksaan otomatis ini menguji kode yang benar-benar dipakai
(`src/lib/period-scope.ts` dikompilasi lalu dijalankan), sehingga hasilnya
tidak bisa melenceng dari implementasi. Yang **tidak** bisa diuji tanpa
database adalah RLS, trigger, dan hak akses nyata.

Matriks pengujian manual untuk seluruh role dan pergantian periode ada di
[`docs/TESTING_ROLE_PERIODE.md`](docs/TESTING_ROLE_PERIODE.md).

> RLS, trigger arsip, dan penolakan akses lintas periode **wajib** diuji
> manual terhadap Supabase sebelum sistem dipakai untuk kepengurusan nyata.

## Skrip

```bash
npm run dev        # development
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run verify     # typecheck + uji period scope + RPC vs SQL
```

## Dokumen Lain

- `docs/TESTING_ROLE_PERIODE.md` — matriks QA role & periode
- `PANDUAN-TAMBAH-ROLE.md` — cara menambah role baru
- `SETUP-AKUN.md` — pembuatan akun
- `SETUP-DIVISI-SHARED.md` — login divisi bersama
- `role_superadmin.txt` — spesifikasi kebutuhan asli
