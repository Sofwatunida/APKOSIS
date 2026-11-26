/**
 * Uji integrasi statis untuk pembatasan Admin Periode.
 *
 * Menjamin 8 kondisi yang diminta tetap terpasang di kode yang
 * benar-benar dipakai: UI, server action, scope client/server, dan
 * migration database. Tidak mengubah data database.
 *
 * Jalankan: node scripts/verify-period-access.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let pass = 0;
let fail = 0;
function check(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  OK   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? " -> " + detail : ""}`);
  }
}
const has = (text, needle) => text.includes(needle);
const hasAll = (text, needles) => needles.every((n) => has(text, n));

console.log("1. Sumber periode Admin (profile.periode_id, bukan cookie)");
{
  const period = read("src/lib/period.ts");
  const server = read("src/lib/supabase/server.ts");
  check(
    "getPeriodeContext memfilter options dari profile.periode_id",
    has(period, 'const admin = profile?.role === "admin";') &&
      has(period, "profile?.periode_id")
  );
  check(
    "cookie diabaikan untuk Admin",
    has(period, "const raw = admin ? null : await getRawPeriodCookie();")
  );
  check(
    "Admin tidak boleh ganti periode; read-only bila bukan active",
    hasAll(period, [
      "canChangePeriod: !admin",
      'readOnly: selected.status !== "active"',
    ])
  );
  check(
    "server scope memakai profiles.periode_id untuk Admin",
    hasAll(server, [
      "profile.role === \"admin\"",
      "return profile.periode_id ?? null;",
      "getImpersonation()",
    ])
  );
}

console.log("2. Navigasi Dashboard per role");
{
  const nav = read("src/lib/nav.ts");
  check(
    "Admin ke /dashboard/admin, Super Admin ke /dashboard/superadmin",
    hasAll(nav, [
      '{ label: "Dashboard", href: "/dashboard/superadmin", roles: ["super_admin"] }',
      '{ label: "Dashboard", href: "/dashboard/admin", roles: ["admin"] }',
      'href: "/dashboard"',
    ])
  );
  check(
    "tidak ada lagi Dashboard semua role ke /dashboard/superadmin",
    !has(nav, '"super_admin",\n      "admin"')
  );
}

console.log("3. Kelola Divisi Periode (Super Admin)");
{
  const page = read("src/app/dashboard/superadmin/akun/page.tsx");
  const client = read(
    "src/app/dashboard/superadmin/akun/accounts-admin-client.tsx"
  );
  const actions = read("src/app/dashboard/actions/periode-actions.ts");
  check(
    "server select dan kirim periode_id asli",
    has(page, 'periodeId: actualPeriodeById.get(d.divisi_id) ?? ""') &&
      has(client, 'fd.set("periode_id", periodeId)')
  );
  check(
    "dropdown initialized dari periode_id DB",
    has(client, "value={d.periodeId}")
  );
  check("dropdown terkunci saat pending", has(client, "disabled={pending}"));
  check(
    "server action hanya untuk Super Admin",
    has(actions, 'profile.role !== "super_admin"')
  );
}

console.log("4. Satu jalur password divisi");
{
  const actions = read("src/app/dashboard/actions/periode-actions.ts");
  const wrapper = read(
    "src/app/dashboard/admin/password-divisi/actions.ts"
  );
  const client = read(
    "src/app/dashboard/admin/password-divisi/password-divisi-client.tsx"
  );
  const validator = read("src/lib/division-password.ts");
  check(
    "server action memakai validator + resolver periode writable",
    hasAll(actions, [
      "validateDivisiPassword(password)",
      "resolveWritablePeriodeId(profile, periodeId)",
    ])
  );
  check(
    "action lama mendelegasi ke satu jalur",
    has(wrapper, "await setDivisionPasswordAction(formData)")
  );
  check(
    "batas 4-128 karakter dipakai bersama",
    hasAll(validator, [
      "DIVISI_PASSWORD_MIN_LENGTH = 4",
      "DIVISI_PASSWORD_MAX_LENGTH = 128",
    ]) &&
      hasAll(client, [
        "DIVISI_PASSWORD_MIN_LENGTH",
        "DIVISI_PASSWORD_MAX_LENGTH",
      ])
  );
}

console.log("5. Penolakan perubahan periode read-only / di luar penugasan");
{
  const period = read("src/lib/period.ts");
  const sql = read(
    "supabase/migrations/20261126000000_admin_period_scope_hardening.sql"
  );
  check(
    "helper server action menolak write ke non-active",
    has(period, "resolveWritablePeriodeId") &&
      has(period, "target.status !== \"active\"")
  );
  check(
    "can_access_period Admin = profilnya saja",
    has(sql, "p_period_id = public.profile_period_id()")
  );
  check(
    "writable hanya untuk status active",
    has(sql, "and pe.status = 'active'")
  );
  check(
    "guard RPC periode divisi",
    hasAll(sql, [
      "public.admin_divisi_set_period(",
      "not public.is_period_writable(p_periode_id)",
      "Anda hanya dapat mengelola periode penugasan Anda.",
    ])
  );
  check(
    "guard RPC akun divisi",
    hasAll(sql, [
      "public.admin_division_account_save(",
      "#variable_conflict use_column",
      "v_target <> public.profile_period_id()",
      "not public.is_period_writable(v_target)",
    ])
  );
  check(
    "RLS write divisi ikut menolak periode non-writable",
    hasAll(sql, [
      'drop policy if exists "Divisi: admin period" on public.divisi;',
      'create policy "Divisi: admin ubah periode" on public.divisi',
      "public.is_period_writable(periode_id)",
    ])
  );
}

console.log("6. Role lain tidak diubah");
{
  const sql = read(
    "supabase/migrations/20261126000000_admin_period_scope_hardening.sql"
  );
  check(
    "monitoring/sekretaris/bendahara & division_admin tetap pada cabang lama",
    hasAll(sql, [
      "when public.current_role() in ('monitoring', 'sekretaris', 'bendahara') then",
      "pe.status in ('active', 'archived')",
      "when public.current_role() = 'division_admin' then",
    ])
  );
  check(
    "Super Admin tetap bisa seluruh periode",
    has(sql, "when public.is_super_admin() then true")
  );
  check(
    "migration tidak menghapus penugasan lama",
    !has(sql, "delete from public.admin_periods")
  );
}

const pkg = JSON.parse(read("package.json"));
check(
  "verify menjalankan uji integrasi ini",
  has(pkg.scripts.verify, "verify:access")
);

console.log("");
console.log(`Hasil: ${pass} lulus, ${fail} gagal.`);
if (fail > 0) process.exit(1);
