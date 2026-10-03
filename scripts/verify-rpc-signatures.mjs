/**
 * Memeriksa migration SQL terhadap tipe di src/lib/database.types.ts.
 *
 * Menangkap kelas bug yang mahal: RPC yang berubah di SQL tapi lupa
 * diubah di TypeScript (atau sebaliknya), sehingga tidak akan pernah
 * bisa dipanggil dari aplikasi.
 *
 * Jalankan: node scripts/verify-rpc-signatures.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const sql = readFileSync(
  join(root, "supabase/migrations/20261001000002_rls_authorization_periods.sql"),
  "utf8"
);
const types = readFileSync(join(root, "src/lib/database.types.ts"), "utf8");

let fail = 0;
const ok = (m) => console.log(`  OK   ${m}`);
const bad = (m) => {
  fail++;
  console.log(`  FAIL ${m}`);
};

/* ---------- 1. Struktur blok $$ ---------- */
{
  const open = (sql.match(/\$\$/g) || []).length;
  if (open % 2 === 0) ok(`blok $$ seimbang (${open} penanda)`);
  else bad(`blok $$ tidak seimbang (${open} penanda)`);
}

/* ---------- 2. Tanda kutiptegangan ---------- */
{
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "''");
  const singles = (stripped.match(/'/g) || []).length;
  if (singles % 2 === 0) ok("jumlah kutip tunggal seimbang");
  else bad(`jumlah kutip tunggal ganjil (${singles})`);

  const doubles = (stripped.match(/"/g) || []).length;
  if (doubles % 2 === 0) ok("jumlah kutip ganda seimbang");
  else bad(`jumlah kutip ganda ganjil (${doubles})`);
}

/* ---------- 3. Kumpulkan definisi fungsi ---------- */
const sqlFunctions = new Map();
{
  const re =
    /create\s+or\s+replace\s+function\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*\nreturns\s+(table\s*\([\s\S]*?\)|[\w\s]+)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1];
    const params = m[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.replace(/\s+default\s+[\s\S]+$/i, "").trim())
      .map((p) => {
        const toks = p.replace(/\s+default\s+[\s\S]+$/i, "").trim().split(/\s+/);
        const type = toks[toks.length - 1] || "";
        const name = (toks[toks.length - 2] || "").toLowerCase();
        const maybeMode = (toks[toks.length - 3] || "").toLowerCase();
        const mode = ["in", "out", "inout"].includes(maybeMode) ? maybeMode : "in";
        return { mode, type, name };
      });
    sqlFunctions.set(name, { params, returns: m[3].replace(/\s+/g, " ").trim() });
  }
}

/* ---------- 4. Bandingkan dengan database.types.ts ---------- */
{
  const blockMatch = types.match(/admin_period_create:[\s\S]*?\n {6}admin_divisi_set_period:[\s\S]*?\n {6}\};/);
  const block = blockMatch ? blockMatch[0] : "";
  if (!block) {
    bad("blok Functions admin_* tidak ditemukan di database.types.ts");
  } else {
    console.log("");
    console.log("4. Tanda tangan RPC SQL vs database.types.ts");
    const re = /(admin_\w+): \{\s*Args:\s*\{([\s\S]*?)\};\s*Returns:/g;
    let m;
    let compared = 0;
    while ((m = re.exec(block)) !== null) {
      const name = m[1];
      const sqlFn = sqlFunctions.get(name);
      if (!sqlFn) {
        bad(`${name} ada di types tapi tidak ada di SQL`);
        continue;
      }

      const argsBlock = m[2] || "";
      // Abaikan tipe returned-table yang juga pernah muncul di blok args.
      // Cocok baik untuk `Args: { a; b; }` maupun `Args: { a: string }` satu baris.
      const argNames = [...argsBlock.matchAll(/(?:^|[\s{;])(p_\w+)\??\s*:/g)].map((x) => x[1]);
      const sqlArgNames = sqlFn.params
        .filter((p) => p.mode === "in" || p.mode === "")
        .map((p) => p.name);

      const missing = argNames.filter((a) => !sqlArgNames.includes(a));
      const extra = sqlArgNames.filter((a) => !argNames.includes(a));

      compared++;
      if (missing.length === 0 && extra.length === 0) {
        ok(`${name}(${sqlArgNames.join(", ") || "tanpa argumen"})`);
      } else {
        bad(
          `${name} parameter tidak cocok` +
            (missing.length ? ` | hilang di SQL: ${missing.join(",")}` : "") +
            (extra.length ? ` | ada di SQL tapi tidak di types: ${extra.join(",")}` : "")
        );
      }
    }
    if (compared === 0) bad("tidak ada RPC yang dibandingkan");
  }
}

/* ---------- 5. Helper keamanan wajib ada di ACL ---------- */
{
  console.log("");
  console.log("5. Helper keamanan masuk daftar ACL");
  for (const fn of [
    "current_role",
    "can_access_period",
    "is_period_writable",
    "is_admin",
    "is_super_admin",
    "profile_period_id",
  ]) {
    if (!sqlFunctions.has(fn)) bad(`fungsi ${fn} tidak didefinisikan`);
    else ok(`${fn} ada di SQL`);
  }
  const acl = sql.slice(sql.lastIndexOf("13. ACL"));
  for (const fn of ["profile_period_id", "can_access_period", "is_period_writable"]) {
    if (acl.includes(`'${fn}'`)) ok(`${fn} ada di blok ACL`);
    else bad(`${fn} TIDAK ada di blok ACL`);
  }
}

/* ---------- 6. Fungsi lama tetap dicabut ---------- */
{
  console.log("");
  console.log("6. Pencabutan fungsi berbahaya");
  if (/revoke\s+all\s+on\s+function\s+public\.set_division_password/i.test(sql))
    ok("set_division_password dicabut");
  else bad("set_division_password tidak dicabut");
}

console.log("");
console.log(fail === 0 ? "Semua pemeriksaan lulus." : `${fail} pemeriksaan gagal.`);
process.exit(fail === 0 ? 0 : 1);
