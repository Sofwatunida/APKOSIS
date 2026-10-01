# Setup Login Divisi Bersama (role `division_admin`)

Sistem baru **khusus role `division_admin`**. Satu akun Supabase Auth dipakai untuk seluruh divisi, lalu user memilih divisi dan memasukkan password divisi.

Role **monitoring**, **sekretaris**, dan **bendahara** **tidak berubah sama sekali** — login, dashboard, RLS, dan middleware mereka tetap seperti sebelumnya.

## Alur baru

```
LOGIN (email + password Auth)
   └─ role = division_admin  →  /pilih-divisi  →  pilih divisi  →  password divisi  →  /dashboard
   └─ role lain              →  /dashboard (persis seperti sebelumnya)
```

Sesi divisi berlaku **12 jam**, disimpan per peramban, jadi dua perangkat bisa mengelola divisi berbeda tanpa saling menimpa.

---

## Langkah 1 — Jalankan migration

**Supabase Dashboard → SQL Editor**, jalankan seluruh isi file **berurutan**:

```
supabase/migrations/20260110000000_division_admin_shared_login.sql
supabase/migrations/20260111000000_division_password_settings.sql
supabase/migrations/20260112000000_fix_pgcrypto_and_rpc_acl.sql
supabase/migrations/20260113000000_password_security_followup.sql
```

Migration `012` **wajib** — ia memperbaiki `pgcrypto` search path dan mengunci akses RPC
(lihat [Catatan verifikasi](#catatan-verifikasi)). Migration `013` memperbaiki logika
fungsi pemeriksaan dan membuat penggantian password langsung mengakhiri sesi aktif.

Yang dibuat:

| Objek | Keterangan |
|-------|------------|
| `division_credentials` | hash password per divisi. **Tidak ada policy `select`** → hash tidak bisa dibaca dari client, verifikasi lewat RPC. |
| `division_sessions` | sesi divisi aktif (token, user, divisi, kedaluwarsa). |
| `division_session_token()` | membaca header `x-division-token` dari permintaan PostgREST. |
| `verify_division_password()` | RPC bandingkan password dengan `crypt()` (bcrypt). |
| `start_division_session()` | RPC: verifikasi password → buat token sesi. |
| `end_division_session()` | RPC: hapus sesi. |
| `division_credential_status()` | RPC: daftar divisi + apakah sudah punya password. **Tidak pernah mengembalikan hash.** |
| `set_division_password(uuid, text)` | RPC: set/ganti password. Granted ke `authenticated`, di dalam fungsi tetap dijaga `is_division_admin()`. |

`current_divisi_id()` diperbarui, tetapi cabang `else` untuk role selain `division_admin` mengembalikan ekspresi yang sama persis seperti sebelumnya. Semua policy RLS monitoring/sekretaris/bendahara tetap utuh.

Tidak ada lagi fungsi SQL tanpa pemeriksaan role. Seluruh RPC baru dijaga di dalam
fungsi dengan `is_division_admin()`, bukan hanya lewat hak akses.

## Langkah 2 — Buat akun Auth divisi

**Dashboard → Authentication → Users → Add user**

| Email | Keterangan |
|-------|------------|
| `divisi.apkosis26@gmail.com` | Satu-satunya akun Auth untuk `division_admin`. |

Isi **Email** dan **Password**, centang **Auto Confirm User** (supaya tidak perlu verifikasi email), lalu **Create user**.

## Langkah 3 — Set role akun tersebut

Baris `profiles` dibuat otomatis oleh trigger `handle_new_user` saat user dibuat. Buka **Table Editor → `profiles`**, cari baris dengan email `divisi.apkosis26@gmail.com`, lalu set:

- `role` = `division_admin`
- `divisi_id` = `NULL`

> `divisi_id` sengaja dikosongkan. Divisi ditentukan oleh pilihan user saat masuk, bukan oleh baris profile.

Alternatif lewat SQL Editor:

```sql
update public.profiles
set role = 'division_admin', divisi_id = null
where email = 'divisi.apkosis26@gmail.com';
```

> Akun `division_admin` lama per-divisi (jika masih ada) **tidak dihapus**. Kalau salah satu ikut login, perilakunya tetap seperti sebelumnya: langsung memakai `profiles.divisi_id` miliknya sendiri.

## Langkah 4 — Tentukan password tiap divisi (lewat aplikasi)

Password **tidak di-seed dan tidak dibuat otomatis**. Anda yang menentukannya sendiri.

1. Login dengan `divisi.apkosis26@gmail.com`.
2. Aplikasi membuka `/pilih-divisi`.
3. Klik **Pengaturan password divisi** di bawah halaman tersebut — halaman ini bisa
   dibuka **dengan atau tanpa** memilih divisi lebih dulu, jadi tidak ada masalah
   "belum tahu password tapi harus login".
4. Dari menu **Divisi → Password Divisi** (`/dashboard/password-divisi`) isi password
   baru tiap divisi lalu tekan **Simpan**.
5. Konfirmasi muncul: *"Apakah Anda yakin ingin mengubah password Divisi 05?"* →
   **Batal** atau **Simpan**.
6. Berhasil: *"Password Divisi 05 berhasil diperbarui."*

Password lama **langsung tidak berlaku** begitu disimpan, dan semua sesi aktif divisi
tersebut ikut diakhiri — penggunanya langsung diminta masuk lagi dengan password baru.

Untuk seeding sekali lewat SQL Editor, **juga mengakhiri sesi divisi itu**:

Kalau hanya perlu melakukan seeding sekali lewat SQL Editor, jalankan langsung
(tanpa fungsi, tanpa menyimpan password di mana pun):

```sql
insert into public.division_credentials (divisi_id, password_hash, updated_at)
select d.id, crypt('password-divisi-01', gen_salt('bf')), now()
  from public.divisi d where d.nomor_divisi = 1
on conflict (divisi_id) do update
  set password_hash = excluded.password_hash, updated_at = now();
```

Ulangi dengan nomor divisi 2–20. Cara utama tetap lewat halaman aplikasi.

Cek divisi yang sudah punya password:

```sql
select nomor_divisi, nama_divisi, has_password, updated_at
from public.division_credential_status();
```

> Panggil dari SQL Editor hanya melihat data yang ada; untuk akun biasa fungsi ini
> mengembalikan 0 baris kecuali pemanggilnya `division_admin`.

### Aturan password yang berlaku

- Tidak ada password acak, tidak ada password default, tidak ada password yang di-hardcode.
- Password yang Anda ketik **di-hash dengan bcrypt di dalam database** sebelum disimpan.
- Password yang tersimpan **tidak pernah ditampilkan** kembali, baik di halaman ini
  maupun lewat API. Yang tampil hanya status *Sudah/Belum diatur* dan waktu pembaruan.
- Setelah Simpan, nilai yang Anda ketik **masih terlihat di kolom input** supaya bisa
  disalin dan diberikan kepada user divisi. Nilai itu berasal dari yang Anda ketik,
  bukan dibaca dari database, dan hilang begitu kolom dikosongkan atau halaman dimuat ulang.
- Password tidak pernah disimpan di `localStorage`, `sessionStorage`, maupun kode sumber.

## Verifikasi

```bash
npm run dev
```

| Yang diuji | Hasil yang diharapkan |
|------------|----------------------|
| `divisi.apkosis26@gmail.com` | setelah login → `/pilih-divisi`, pilih divisi, masukkan password → dashboard divisi itu |
| Password divisi salah | ditolak, tetap di `/pilih-divisi` |
| `/dashboard` tanpa sesi divisi | di-redirect ke `/pilih-divisi` |
| Ganti divisi | dashboard berganti ke divisi baru, data ikut berganti |
| `/dashboard/password-divisi` | daftar 20 divisi, input password baru + tombol Simpan |
| Simpan password | modal konfirmasi muncul, `Batal` membatalkan |
| Simpan password (sukses) | toast *"Password Divisi 05 berhasil diperbarui."* |
| Ganti password yang sudah ada | password lama langsung tidak berlaku |
| Buka `/dashboard/password-divisi` tanpa sesi divisi | tetap bisa dibuka (tidak butuh pilih divisi) |
| Akun **monitoring** | login → dashboard monitoring, **tidak pernah** melihat `/pilih-divisi` maupun `/dashboard/password-divisi` |
| Akun **bendahara** | login → dashboard bendahara, **tidak pernah** melihat kedua halaman |
| Akun **sekretaris** | login → dashboard sekretaris, **tidak pernah** melihat kedua halaman |

Cek cepat bahwa role lain tidak tersentuh:

```sql
select role, count(*) from public.profiles group by role order by role;
```

Harus tetap 4 role yang sama seperti sebelumnya.

## Catatan verifikasi

Hasil pemeriksaan langsung ke project Supabase (lewat REST API memakai publishable key):

| Pemeriksaan | Hasil |
|-------------|-------|
| Tabel `division_sessions` & `division_credentials` ada | Ya (RLS menutup akses anon) |
| Fungsi ter-discover PostgREST | Ya |
| `set_division_password` menolak non-division_admin | Ya — `P0001 "Akses hanya untuk akun divisi (division_admin)."` |
| `division_credential_status` menolak non-division_admin | Ya — 0 baris |

Dua masalah ditemukan dan **sudah diperbaiki oleh migration `012`**:

1. **`pgcrypto` tidak ketemu.** Error `function gen_salt(unknown) does not exist`,
   karena ekstensi ini terpasang di schema `extensions`, sementara fungsinya
   `set search_path = public`. Migration `012` menambah `division_crypto_search_path()`
   yang mencari sendiri schema pgcrypto lalu menerapkannya, jadi tidak perlu menebak.
2. **EXECUTE default untuk `anon`.** Project ini memberi EXECUTE otomatis ke role
   `anon` untuk fungsi baru di schema `public`, sehingga `revoke ... from public`
   saja tidak cukup. Migration `012` menambah `revoke ... from anon` eksplisit.
   Utilitas `set_division_password_by_number` juga dihapus karena tidak punya
   pemeriksaan role sama sekali.

Hasil setelah `012` dijalankan (pemeriksaan ulang via REST API):

| Fungsi | Sebelum `012` | Setelah `012` |
|--------|---------------|---------------|
| `set_division_password_by_number` | bisa dipanggil anon | `PGRST202` (sudah dihapus) |
| `end_division_session` | `204` dieksekusi | `42501` permission denied |
| `division_session_token` | `200 null` | `42501` permission denied |
| `division_credential_status` | `200 []` | `42501` permission denied |

Verifikasi hashing (jalankan di **Supabase SQL Editor**, bukan di terminal):

```sql
select public.division_password_selfcheck() as hashing_ok;
```

Hasilnya harus `true`.

Kalau `\false`, `pgcrypto` belum aktif. Pasang lewat
**Supabase Dashboard → Database → Extensions → pgcrypto → Enable**, lalu ulangi.

Alternatif tanpa fungsi bantu — query ini memakai pola verifikasi yang sama persis
dengan `verify_division_password()`:

```sql
with t as (select crypt('probe', gen_salt('bf')) as h)
select crypt('probe', h) = h as hashing_ok from t;
```

Kalau hasil query terakhir ini `true`, hashing sudah pasti benar.

## Catatan operasional

- **Sesi 12 jam.** Setelah kedaluwarsa, user diminta memilih divisi lagi.
- **Logout menghapus sesi divisi.** Kalau tidak logout dan hanya menutup tab, divisi terakhir masih aktif di peramban itu.
- **Satu peramban satu divisi.** Kalau perlu mengelola dua divisi sekaligus, buka tab/incognito kedua.
- **Ganti password = logout semua sesi divisi tersebut.** Setelah password disimpan,
  seluruh baris di `division_sessions` untuk divisi itu langsung dihapus. Jadi siapa pun
  yang sedang masuk dengan password lama **langsung kehilangan akses**, bukan hanya
  tidak bisa login lagi. Pengunjung tersebut akan diminta memilih divisi dan
  memasukkan password baru.

  Hapus paksa semua sesi tanpa melihat password mana yang berubah:

```sql
delete from public.division_sessions;
```

## File yang berubah

**Baru**

- `supabase/migrations/20260110000000_division_admin_shared_login.sql`
- `supabase/migrations/20260111000000_division_password_settings.sql`
- `supabase/migrations/20260112000000_fix_pgcrypto_and_rpc_acl.sql`
- `supabase/migrations/20260113000000_password_security_followup.sql`
- `src/app/pilih-divisi/page.tsx`
- `src/app/pilih-divisi/pilih-divisi-client.tsx`
- `src/app/pilih-divisi/actions.ts`
- `src/lib/division-session.ts`
- `src/lib/division-session-constants.ts`
- `src/lib/division-session-client.ts`
- `src/app/dashboard/password-divisi/page.tsx`
- `src/app/dashboard/password-divisi/password-divisi-client.tsx`
- `src/app/dashboard/password-divisi/actions.ts`

**Diubah**

- `src/app/dashboard/page.tsx` dan 8 halaman `division_admin` — ditambahkan pemanggilan `requireDivisionSelection()` + `withActiveDivisi()`.
- `src/app/dashboard/program-kerja/page.tsx` — 2 baris tambahan; untuk role selain `division_admin` keduanya tidak berefek.
- `src/lib/supabase/client.ts` — browser client menyertakan header `x-division-token`. Tanpa cookie tersebut (yaitu untuk monitoring/bendahara/sekretaris) perilakunya **identik** dengan sebelumnya.
- `src/components/dashboard-shell.tsx` — `clearDivisionTokenCookie()` saat logout (tidak berefek tanpa cookie tersebut) + ikon `KeyRound` untuk menu Password Divisi.
- `src/app/dashboard/not-configured.tsx` — memanggil `clearDivisionTokenCookie()` saat logout.
- `src/lib/nav.ts` — satu item menu *Password Divisi*, `roles: ["division_admin"]`.
- `src/lib/database.types.ts` — tipe untuk dua tabel baru dan RPC baru.

**Tidak disentuh**

- `src/app/login/page.tsx` — form login tetap sama.
- `src/lib/supabase/middleware.ts` dan `src/middleware.ts` — tidak ada perubahan.
- `src/lib/guard.ts`, `src/lib/role.ts`, `src/lib/types.ts`.
- Seluruh tabel, policy, trigger, dan storage policy milik monitoring / sekretaris / bendahara.
