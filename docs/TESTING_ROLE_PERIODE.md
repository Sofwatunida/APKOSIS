# Matriks Testing Role & Periode (Phase 12 & 13)

Dokumen ini adalah checklist pengujian manual. Pengujian memerlukan
Supabase project yang sudah menjalankan seluruh migration dan minimal
satu akun untuk tiap role.

## Bagian yang sudah diuji otomatis

Jalankan lebih dulu; ini bisa dilakukan tanpa database:

```bash
npm run verify
```

| Pemeriksaan | Cakupan |
|---|---|
| `npm run typecheck` | Seluruh TypeScript |
| `npm run verify:period` | 23 pemeriksaan pada `src/lib/period-scope.ts` versi asli: filter baca, injeksi `periode_id` pada insert/update/upsert, penolakan `periode_id` dari luar,(update/delete terfilter, mode semua-periode |
| `npm run verify:rpc` | Tanda tangan 11 RPC di SQL cocok dengan `database.types.ts`, helper keamanan masuk daftar ACL, `set_division_password` tetap dicabut |

Yang **tidak** bisa diuji otomatis adalah RLS, trigger, dan hak akses
nyata. Bagian A–H di bawah wajib dijalankan manual.

> Catatan revisi: `can_access_period()` sebelumnya mengizinkan
> `monitoring`/`sekretaris`/`bendahara` membaca **periode apa pun** hanya
> karena UUID-nya bukan NULL, dan `is_period_writable()` mengizinkan
> menulis ke **periode aktif mana pun**. Keduanya kini dikunci ke
> `profiles.periode_id`. Karena tidak ada pengujian otomatis terhadap
> database, bagian B dan G di bawah sangat penting.

## Persiapan

1. Jalankan seluruh migration di `supabase/migrations/` pada Supabase
   project yang dipakai, berurutan berdasarkan nama file.
2. Pastikan ada tepat satu akun `super_admin`:
   ```sql
   select id, email, role from public.profiles where role = 'super_admin';
   ```
3. Sediakan akun uji: 1 `admin`, 1 `division_admin`, 1 `monitoring`,
   1 `bendahara`, 1 `sekretaris`.
4. Pastikan tabel `periods` berisi `2026/2027` dengan status `active`.

---

## A. Otorisasi Per Role (Phase 12)

| # | Pengujian | Role | Harap |
|---|-----------|------|-------|
| A1 | Buka `/dashboard` | `super_admin` | Redirect ke `/dashboard/superadmin` |
| A2 | Buka `/dashboard` | `admin` | Redirect ke `/dashboard/admin` |
| A3 | Buka `/dashboard/superadmin/*` | `admin` | Redirect ke `/dashboard` |
| A4 | Buka `/dashboard/superadmin/*` | `division_admin` | Redirect ke `/dashboard` |
| A5 | Buka `/dashboard/admin/*` | `super_admin` | Boleh (jalur recovery) |
| A6 | Buka `/dashboard/admin/password-divisi` | `division_admin` | Redirect ke `/dashboard` |
| A7 | Menu sidebar | `division_admin` | Tidak ada menu Super Admin / Admin Periode |
| A8 | Buka `/dashboard/laporan` | `bendahara` | Redirect ke `/dashboard` |
| A9 | Panggil `admin_period_activate` via RPC | `admin` | Error `42501` |
| A10 | Ubah role akun sendiri jadi `super_admin` | `admin` | Tidak ada opsi / ditolak |

## B. Batas Kekuasan Admin Periode (Aturan 5C)

| # | Pengujian | Harap |
|---|-----------|-------|
| B1 | `admin` ditugaskan ke 2026/2027, lalu Super Admin buat 2027/2028 | `admin` **tidak** otomatis access 2027/2028 |
| B2 | Buka `/dashboard/admin` sebagai `admin` periode 2026/2027 | Hanya data 2026/2027 yang muncul |
| B3 | Query `transaksi_keuangan` periode 2027/2028 sebagai `admin` 2026/2027 | 0 baris (RLS menolak) |
| B4 | Hapus `admin_periods` untuk `admin` lalu buka dashboard | Tombol tulis menolak, data kosong |

## C. Admin Tidak Dapat Ambil Alih Super Admin (Aturan 5E)

| # | Pengujian | Harap |
|---|-----------|-------|
| C1 | `admin` memanggil `admin_set_user_role` | Error `42501` |
| C2 | `admin` memanggil `admin_assign_period` | Error `42501` |
| C3 | `admin` mengubah role akun Super Admin | Error `42501` |
| C4 | `admin` memanggil `admin_set_division_password` untuk periode yang tidak ditugaskan | Error `42501` |
| C5 | `super_admin` menurunkan role Super Admin terakhir | Error "Minimal harus ada satu akun Super Admin" |

## D. Kredensial Divisi (Phase 8)

| # | Pengujian | Harap |
|---|-----------|-------|
| D1 | `division_admin` insert langsung ke `division_credentials` | Ditolak (policy dihapus) |
| D2 | `division_admin` memanggil `set_division_password` | revoked |
| D3 | `admin` reset password divisi | Berhasil |
| D4 | `admin` reset password divisi di periode yang tidak ditugaskan | Error `42501` |
| D5 | Tampilan hash password di client | Tidak pernah ada di respons |
| D6 | Sesi divisi aktif setelah password di-reset | Sesi berakhir, harus login ulang |

## E. Pergantian Periode (Phase 13)

| # | Pengujian | Harap |
|---|-----------|-------|
| E1 | Tanpa cookie periode, buka dashboard | Otomatis periode aktif |
| E2 | Ganti periode lewat dropdown ke periode lama | Hanya data periode itu |
| E3 | Cache cookie periode, reload halaman | Periode tetap sama |
| E4 | Tulis cookie `apkosis_periode` dengan uuid asing | Fallback ke periode aktif, bukan halaman kosong |
| E5 | Tulis cookie bernilai `semua-periode` sebagai `admin` | Diabaikan (bukan read-all) |
| E6 | `super_admin` memilih "Semua Periode" | Data seluruh periode tampil |
| E7 | Beralih ke mode "Semua Periode" lalu coba simpan | Ditolak (butuh satu periode aktif) |

## F. Periode Arsip = Read Only (Phase 10)

| # | Pengujian | Harap |
|---|-----------|-------|
| F1 | Arsipkan periode lama sebagai `super_admin` | Status jadi `archived` |
| F2 | Buka periode arsip sebagai `division_admin` | Banner read-only, form terkunci |
| F3 | Tambah laporan di periode arsip | Error trigger / RLS |
| F4 | Update laporan di periode arsip | Error trigger / RLS |
| F5 | Hapus laporan di periode arsip | Error trigger / RLS |
| F6 | Arsipkan satu-satunya periode aktif | Ditolak |
| F7 | `super_admin` mengoreksi arsip | Boleh (kebijakan "koreksi data arsip") |

## G. Periode Tidak Tercampur

| # | Pengujian | Harap |
|---|-----------|-------|
| G1 | Buat transaksi identik di dua periode | Masing-masing hanya muncul di periodenya |
| G2 | Cek saldo awal setelah pindah periode | Nilai berbeda per periode, tidak saling menimpa |
| G3 | Export dari periode A, lalu periode B | Nama file & kop dokumen menyebut periode yang benar |
| G4 | Cek semua dropdown tahun | Tidak ada daftar tahun hardcoded |
| G5 | `bendahara`/`monitoring`/`sekretaris`/Admin Divisi mengubah cookie ke UUID periode lain | Data periode lain **tidak** terlihat (RLS menolak) |
| G6 | `bendahara` mencoba insert ke UUID periode lain secara langsung | Error `42501` (`is_period_writable` = false) |
| G7 | Admin periode A mencoba `admin_division_credential_status(null)` | Error / 0 baris, bukan daftar seluruh periode |
| G8 | Admin periode A memanggil `admin_divisi_set_period` untuk divisi milik periode B | Error `42501` "sudah terikat ke periode lain" |
| G9 | Admin tanpa penugasan memanggil `is_admin()` | `false` |

## H. Query SQL Per langsung

```sql
-- pastikan periode_id selalu terisi
select 'laporan_harian' t, count(*) from public.laporan_harian where periode_id is null
union all select 'transaksi_keuangan', count(*) from public.transaksi_keuangan where periode_id is null
union all select 'kebutuhan', count(*) from public.kebutuhan where periode_id is null
union all select 'pengajuan_dana', count(*) from public.pengajuan_dana where periode_id is null
union all select 'inventaris', count(*) from public.inventaris where periode_id is null
union all select 'program_kerja', count(*) from public.program_kerja where periode_id is null
union all select 'anggota_divisi', count(*) from public.anggota_divisi where periode_id is null
union all select 'opsi_kegiatan', count(*) from public.opsi_kegiatan where periode_id is null
union all select 'kendala_solusi', count(*) from public.kendala_solusi where periode_id is null
union all select 'saldo_awal', count(*) from public.saldo_awal where periode_id is null;

-- semua hasil harus 0
```

```sql
-- hanya boleh ada satu periode aktif
select count(*) as jumlah_aktif from public.periods where status = 'active';
```
