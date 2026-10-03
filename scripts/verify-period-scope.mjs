/**
 * Uji statis untuk period scope (Phase 12-13).
 *
 * Menguji IMPLEMENTASI ASLI `src/lib/period-scope.ts` (bukan salinannya),
 * supaya hasil uji tidak bisa melenceng dari kode yang benar-benar dipakai.
 *
 * Build dulu file yang diuji:
 *   npx tsc src/lib/period-scope.ts src/lib/period-constants.ts \
 *         --outDir .verify --module commonjs --target es2020 \
 *         --moduleResolution node --skipLibCheck
 *
 * Jalankan:
 *   node scripts/verify-period-scope.mjs
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, "..", ".verify", "period-scope.js");

if (!existsSync(compiled)) {
  console.error(
    "File hasil build tidak ada. Jalankan perintah tsc yang tertulis di header file ini."
  );
  process.exit(2);
}

const require = createRequire(import.meta.url);
const { scopeBuilderWithPeriod, readPeriodCookie, writePeriodCookie } =
  require(compiled);

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  OK   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

/** Fake PostgREST builder yang mencatat operasi dan filternya. */
function fakeBuilder(log) {
  const state = { filters: [] };
  const builder = {
    eq: (c, v) => {
      state.filters.push([c, v]);
      return builder;
    },
  };
  for (const name of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "maybeSingle",
    "single",
    "order",
    "limit",
  ]) {
    builder[name] = (...args) => {
      log.push({ op: name, args, filters: state.filters.slice() });
      return builder;
    };
  }
  return builder;
}

const scoped = (table, periodId, log = []) => [
  scopeBuilderWithPeriod(fakeBuilder(log), table, periodId),
  log,
];

console.log("1. Tabel tanpa periode_id tidak diberi filter");
{
  const [b, log] = scoped("divisi", "P1");
  b.select("*");
  check("divisi tetap tanpa filter", log.length === 1 && log[0].filters.length === 0);
}

console.log("2. Tabel periode selalu difilter saat baca");
{
  for (const table of [
    "laporan_harian",
    "kendala_solusi",
    "transaksi_keuangan",
    "saldo_awal",
    "kebutuhan",
    "pengajuan_dana",
    "inventaris",
    "program_kerja",
    "anggota_divisi",
    "opsi_kegiatan",
  ]) {
    const [b, log] = scoped(table, "P1");
    b.select("*");
    check(
      `${table} difilter periode_id`,
      log[0].filters.some(([c, v]) => c === "periode_id" && v === "P1"),
      JSON.stringify(log[0].filters)
    );
  }
}

console.log("3. insert / update / upsert mengisi periode_id");
{
  for (const method of ["insert", "update", "upsert"]) {
    const [b, log] = scoped("transaksi_keuangan", "P1");
    b[method]({ nominal: 1000, keterangan: "x" });
    check(
      `${method} menyuntik periode_id`,
      log[0]?.args[0]?.periode_id === "P1",
      JSON.stringify(log[0]?.args[0])
    );
  }
}

console.log("4. User tidak bisa mengarahkan baris ke periode lain");
{
  const [b, log] = scoped("transaksi_keuangan", "P1");
  b.insert({ nominal: 1000, periode_id: "PERIODE_LAIN" });
  check("insert dipaksa ke P1", log[0].args[0].periode_id === "P1");

  const [b2, log2] = scoped("laporan_harian", "P1");
  b2.update({ periode_id: "PERIODE_LAIN" }).eq("id", "abc");
  check("update dipaksa ke P1", log2[0].args[0].periode_id === "P1");
}

console.log("5. update dan delete dibatasi ke periode terpilih");
{
  const [b, log] = scoped("transaksi_keuangan", "P1");
  b.update({ nominal: 1 }).eq("id", "abc");
  check(
    "update terfilter periode",
    log[0].filters.some(([c, v]) => c === "periode_id" && v === "P1"),
    JSON.stringify(log[0].filters)
  );

  const [b2, log2] = scoped("kebutuhan", "P1");
  b2.delete().eq("id", "abc");
  check(
    "delete terfilter periode",
    log2[0].filters.some(([c, v]) => c === "periode_id" && v === "P1"),
    JSON.stringify(log2[0].filters)
  );
}

console.log("6. Upsert saldo awal per periode");
{
  const [b, log] = scoped("saldo_awal", "P1");
  b.upsert({ nominal: 500 }, { onConflict: "periode_id" });
  check(
    "upsert saldo awal terisi periode_id",
    log[0].args[0].periode_id === "P1",
    JSON.stringify(log[0].args[0])
  );
}

console.log("7. Mode semua-periode (super_admin) tidak memasang filter");
{
  const [b, log] = scoped("laporan_harian", null);
  b.select("*");
  check("baca tanpa filter", log[0].filters.length === 0);
  check(
    "tidak pernah pakai nilai sentinel sebagai filter",
    !JSON.stringify(log).includes("semua-periode") &&
      !JSON.stringify(log).includes("__periode_aktif__")
  );
}

console.log("8. Rantai beberapa operasi tetap terkunci ke satu periode");
{
  const [b, log] = scoped("laporan_harian", "P1");
  b.select("*").eq("divisi_id", "D1").order("tanggal");
  const allSelects = log.filter((l) => l.op === "select");
  check(
    "tidak ada operasi tanpa filter periode",
    allSelects.length >= 1 &&
      allSelects.every((l) =>
        l.filters.some(([c, v]) => c === "periode_id" && v === "P1")
      ),
    JSON.stringify(allSelects.map((l) => l.filters))
  );
}

console.log("9. Nilai sentinel dipetakan ke null oleh client scope");
{
  // setClientPeriodScope(null) berarti "semua periode"; sentinel aktif
  // hanya dipakai server sebelum di-resolve.
  const [b, log] = scoped("transaksi_keuangan", null);
  b.insert({ nominal: 1 });
  check(
    "tanpa periode tidak ada injeksi palsu",
    log[0].args[0].periode_id === undefined,
    JSON.stringify(log[0].args[0])
  );
}

console.log("");
console.log(`Hasil: ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
