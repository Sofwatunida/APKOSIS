# PANDUAN MEMBUAT ROLE BARU DI APKOSIS
### (Versi Gampang, Pakai Analogi Supaya Bing)

> Berhenti dulu! Ini cuma catatan panduan. **JANGAN langsung dijalankan** kalau tidak yakin.
> Kalau mau, minta tolong yang paham komputer untuk bantu.

Baca pelan-pelan. Ikuti urutannya. Jangan dilompati.

---

## 🧠 APA ITU "ROLE"?

Bayangkan aplikasi ini seperti **sekolah**.

- Ada murid (divisi) → beda kelas
- Ada guru (pembina / ketua osis) → lihat semua
- Ada wali kelas / sekretaris → bikin rapor (export Excel)
- Ada bendahara → pegang uang

"Role" itu **pekerjaan** yang melekat ke satu akun.

Setiap akun CUMA boleh punya SATU pekerjaan.
Jadi satu orang = satu role. Tidak bisa dua-duanya.

---

## 🚪 DI DALAM APLIKASI INI, PEKERJAAN YANG ADA:

| Role | Sebutan | Boleh ngapain |
|------|---------|---------------|
| `division_admin` | Admin Divisi | Isi laporan, anggota, uang divisinya sendiri |
| `monitoring` | Pemantau / Pelihat | Lihat semua divisi, tapi tidak bisa ubah |
| `sekretaris` | Sekretaris | Lihat semua + export Excel administrasi |
| `bendahara` | Bendahara | Kelola & rekap uang pusat |

Sekarang pelihat / pembina cuma pakai `monitoring`.

---

## 🎯 CONTOH: MAU BUAT ROLE BARU "KETUA OSIS" (`ketua_osis`)

Bayangkan kamu mau menambah pekerjaan baru di sekolah.
Supaya diterima, ada **3 pintu** yang harus kamu buka semua:

```
  1. Daftar nama (Database)   ← guru daftarkan dulu
  2. Buku saya (Kode)         ← aplikasi kenal nama itu
  3. Kunci pintu (Routing)    ← aplikasi kasih akses halaman
```

Kalau SATU saja pintu belum dibuka, **pintu tidak terbuka** ❌.

---

## PINTU 1: DAFTARKAN NAMA DI DATABASE (SUPABASE)

Buka website Supabase → login → proyekmu →
klik **SQL Editor** → tempel kode di bawah → klik **Run**.

```sql
-- (1) Buka daftar nama yang gantian
alter table public.profiles drop constraint profiles_role_check;

-- (2) Tulis daftar nama lagi, kini + ketua_osis
alter table public.profiles add constraint profiles_role_check
  check (role in ('division_admin','monitoring','sekretaris','bendahara','ketua_osis'));

-- (3) Bikin "stempel pengenal" untuk ketua osis
create or replace function public.is_ketua_osis()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'ketua_osis', false);
$$;

-- (4) Kasih izin baca ke ketua osis di tiap tabel
drop policy if exists "Anggota: select ketua_osis" on public.anggota_divisi;
create policy "Anggota: select ketua_osis" on public.anggota_divisi
  for select using (public.is_ketua_osis());
```

> Penjelasan pelan-pelan:
> - Kode (1) & (2) = "hapus daftar lama, tulis daftar baru yang lebih panjang".
>   Ibarat mengganti absen kelas: yang lama dihapus, yang baru ditulis ulang.
> - Kode (3) = bikin penjaga pintu khusus yang kenal "ketua_osis".
> - Kode (4) = ketua_osis boleh **melihat** (select) anggota.
>   Ulangi kode nomor (4) untuk tabel lain kalau mau: `divisi`, `laporan_harian`, `transaksi_keuangan`, dst.
>   Ganti nama tabel dan nama policy-nya saja. Jumlah atribut diluar ini masih cuma "baca".

---

## PINTU 2: KENALKAN NAMA ITU KE APLIKASI (KODE)

Sekarang buka file di komputer, lalu ubah seperti di bawah.

**File 1: `src/lib/types.ts`** → cari baris ini:
```ts
export type Role = "division_admin" | "monitoring" | "sekretaris" | "bendahara";
```
Ganti menjadi:
```ts
export type Role = "division_admin" | "monitoring" | "sekretaris" | "bendahara" | "ketua_osis";
```

**File 2: `src/lib/database.types.ts`** → di baris paling atas ada baris yang sama persis.
Ganti juga menjadi sama seperti di atas.

> Catatan: dua file ini seperti "buku nama". Aplikasi tidak kenal
> `ketua_osis` kalau belum ditulis di kedua buku ini.

---

## PINTU 3: KASIH KUNCI PINTU (ROUTING)

Sekarang bilang ke aplikasi: "ketua_osis boleh masuk ke halaman mana saja?"

**File 3: `src/lib/role.ts`** → tambahkan 2 hal:

Setelah bagian helper, tambahkan:
```ts
export function isKetuaOsis(profile: Profile | null): boolean {
  return profile?.role === "ketua_osis";
}
```

Di dalam `ROLE_LABELS` (daftar nama tampilan), tambahkan:
```ts
ketua_osis: "Ketua OSIS",
```

**File 4: `src/lib/nav.ts`** → tambahkan `"ketua_osis"` di menu Monitoring:
```ts
{ label: "Semua Divisi", href: "/dashboard/monitoring/divisi", roles: ["monitoring", "ketua_osis"] },
{ label: "Laporan", href: "/dashboard/monitoring/laporan", roles: ["monitoring", "ketua_osis"] },
{ label: "Rekap & Kendala", href: "/dashboard/monitoring/rekap", roles: ["monitoring", "ketua_osis"] },
```

**File 5: `src/app/dashboard/dashboard-home.tsx`** → cari bagian:
```ts
if (role === "bendahara") return <BendaharaDashboard profile={profile} />;
```
Tambahkan di bawahnya:
```ts
if (role === "ketua_osis") return <MonitoringDashboard profile={profile} />;
```

**File 6, 7, 8: Halaman monitoring** — 3 file ini:
```
src/app/dashboard/monitoring/divisi/page.tsx
src/app/dashboard/monitoring/laporan/page.tsx
src/app/dashboard/monitoring/rekap/page.tsx
```
Di tiap file, cari baris:
```ts
requireRole(profile, ["monitoring"]);
```
Ganti menjadi:
```ts
requireRole(profile, ["monitoring", "ketua_osis"]);
```

> Penjelasan pelan-pelan:
> - File 3 = daftar "teman" helper + nama tampilan.
> - File 4 = daftar menu di sidebar.
> - File 5 = halaman dashboard pertama setelah login.
> - File 6–8 = penjaga pintu halaman monitoring.
>   Kalau penjaganya tidak mengizinkan `ketua_osis`, ketua osis
>   akan dilempar balik ke dashboard walau menunya ada.

---

## 📝 CARA MENAMBAH AKUN DENGAN ROLE BARU

1. Buka Supabase → **Authentication → Users → Add user**.
   Tulis email (mis. `ketua.apkosis2627@gmail.com`) + password pilihanmu. Klik buat.
2. Buka **Table Editor → `profiles`**.
   Cari baris email itu, ubah kolom `role` menjadi `ketua_osis`.
   Kolom `divisi_id` **dikosongkan** (karena ketua osis lihat semua, bukan satu divisi).

> Kadang baris `profiles` belum muncul. Jangan panik.
> Itu otomatis dibuat oleh aplikasi saat pengguna login pertama kali.
> Kalau mau cepat: login sekali dulu di aplikasi, baru kembali ke Supabase untuk set role.

---

## ✅ CEK HASIL

Setelah semua selesai, jangan lupa:
1. Buka folder proyek, jalankan perintah di terminal:
   ```
   npm run typecheck
   ```
   Kalau tidak muncul error merah, artinya kodenya sehat.
2. Login dengan akun ketua osis → seharusnya masuk dashboard pemantau
   (lihat semua divisi dan laporan).

---

## ⚠️ INGAT-INGAT INI GAMBARAN BESAR

```
Mulai        → Database (SQL Editor)  →  Kode type  →  Helper + Nav  →  Dashboard  →  Guard halaman
       1                2                      3              4              5                6
```

Urutan di atas adalah garis besar kerjanya. Kalau pusing, jangan takut minta
teman yang paham aplikasi untuk melakukannya sambil kamu lihat. 🌱