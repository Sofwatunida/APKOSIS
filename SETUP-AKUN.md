# Setup Akun APKOSIS

Aplikasi **tidak pernah menyimpan password** — semuanya ditangani oleh **Supabase Auth**. Akun **belum ada** dan **harus dibuat manual** oleh administrator di dashboard Supabase. Dokumen ini berisi daftar akun yang harus dibuat.

> Catatan: prompt menentukan email divisi belum lengkap (hanya contoh Keamanan, Kesehatan, Humas). Daftar 20 divisi di seed menggunakan nama generik `Divisi 01`–`Divisi 20`, sesuai arahan prompt *“Karena daftar nama divisi final belum diberikan”*.

## Situasi saat ini

- Tabel (`divisi`, `profiles`, dll.) **belum ada** → jalankan migrasi dulu (lihat README).
- Tidak ada satu pun **akun Auth** yang dibuat.
- Password tidak bisa saya buatkan (prompt: *"Jangan mengarang password"*).

## Langkah yang harus dilakukan (manual, sekali saja)

### 1. Jalankan migrasi database
Buka **Supabase Dashboard → SQL Editor**, lalu jalankan isi dari:
```
supabase/migrations/20260101000000_initial_schema.sql
```
Ini membuat semua tabel, RLS, storage bucket `program-kerja`, dan seed 20 divisi.

### 2. Buat akun Auth untuk 20 divisi
Buka **Dashboard → Authentication → Users → Add user**, buat akun dengan konvensi email berikut:

| No | Email akun | Divisi |
|----|-----------|--------|
| 1  | `keamanan.apkosis2627@gmail.com` | Divisi 01 (Keamanan) |
| 2  | `kesehatan.apkosis2627@gmail.com` | Divisi 02 (Kesehatan) |
| 3  | `humas.apkosis2627@gmail.com` | Divisi 03 (Humas) |
| 4–20 | `<nama-divisi>.apkosis2627@gmail.com` | Divisi 04–20 |

Setiap akun dibuat dengan **password yang Anda tetapkan sendiri**.

### 3. Buat akun Monitoring
Satu akun bersama untuk Ketua OSIS / Pembina:

| Email | Peran |
|-------|-------|
| `apkosis2627@gmail.com` | Monitoring |

### 4. Hubungkan akun ke role & divisi
Setelah akun dibuat, buka **Supabase Dashboard → Table Editor → `profiles`**, lalu untuk setiap baris set:
- `role` = `division_admin` (untuk 20 akun divisi) atau `monitoring` (untuk akun monitoring)
- `divisi_id` = UUID dari tabel `divisi` yang sesuai (mis. divisi Keamanan)

> Baris `profiles` otomatis dibuat oleh trigger saat user pertama kali login/dibuat. Jika belum ada, buat manual atau minta user login sekali.

## Pemetaan divisi → ID

Cari UUID setiap divisi di **Table Editor → `divisi`**, lalu isikan ke kolom `divisi_id` pada `profiles` yang bersangkutan.

## Verifikasi

Setelah selesai:
1. `npm run dev`
2. Login dengan salah satu email divisi → dashboard menampilkan divisi yang sesuai secara otomatis.
3. Login dengan `apkosis2627@gmail.com` → dashboard monitoring seluruh divisi.
