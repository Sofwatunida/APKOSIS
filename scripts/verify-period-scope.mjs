/**
 * Uji statis untuk period scope (Phase 12-13).
 *
 * Menguji IMPLEMENTASI ASRI `src/lib/period-scope.ts` (bukan salinannya),
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
    console.log(`  FAIL ${name}${detail ? " -> " + detail : ""}`);
  }
}

/**
 * Fake PostgREST yang MENIRU API SEBENARNYA supabase-js, yaitu dua tahap:
 *
 *   from(t)      -> PostgrestQueryBuilder
 *                   { select, insert, update, upsert, delete }   <- TIDAK ada .eq()
 *   .select(...) -> PostgrestFilterBuilder
 *                   { eq, neq, order, limit, single, ... , then }
 *
 * Versi lama file ini memakai satu objek yang punya `.eq()` DAN semua
 * method sekaligus. Fake seperti itu TIDAK bisa menangkap bug
 * `target.eq is not a function`, karena di dunia nyata `.from()`
 * sama sekali tidak punya `.eq()`. Karena itu `queryBuilder` di bawah
 * sengaja tidak diberi `.eq()`.
 */
function fakeBuilder(state) {
  const filterBuilder = {
    eq(column, value) {
      state.filters.push([column, value]);
      return filterBuilder;
    },
    order() {
      return filterBuilder;
    },
    limit() {
      return filterBuilder;
    },
    single() {
      return filterBuilder;
    },
    maybeSingle() {
      return filterBuilder;
    },
    select() {
      // `.insert(...).select(...)` lazim dipakai; tetap FilterBuilder.
      return filterBuilder;
    },
    then(resolve) {
      state.executions.push({ filters: state.filters.slice() });
      return Promise.resolve(resolve ? resolve({ data: [] }) : { data: [] });
    },
  };

  // PostgrestQueryBuilder: HANYA lima method ini. Sengaja tanpa `.eq()`.
  const queryBuilder = {};
  for (const name of ["select", "insert", "update", "upsert", "delete"]) {
    queryBuilder[name] = (...args) => {
      state.ops.push({ op: name, args });
      return filterBuilder;
    };
  }
  return queryBuilder;
}

function newState() {
  return { filters: [], ops: [], executions: [] };
}

const scoped = (table, periodId) => {
  const state = newState();
  const builder = scopeBuilderWithPeriod(fakeBuilder(state), table, periodId);
  return [builder, state];
};

const hasPeriodFilter = (state, periodId) =>
  state.filters.some(([c, v]) => c === "periode_id" && v === periodId);

console.log("1. Tabel tanpa periode_id tidak diberi filter");
{
  const [b, state] = scoped("divisi", "P1");
  b.select("*");
  check("divisi tetap tanpa filter", state.filters.length === 0, JSON.stringify(state.filters));
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
    const [b, state] = scoped(table, "P1");
    b.select("*");
    check(
      `${table} difilter periode_id`,
      hasPeriodFilter(state, "P1"),
      JSON.stringify(state.filters)
    );
  }
}

console.log("3. insert / update / upsert mengisi periode_id");
{
  for (const method of ["insert", "update", "upsert"]) {
    const [b, state] = scoped("transaksi_keuangan", "P1");
    b[method]({ nominal: 1000, keterangan: "x" });
    check(
      `${method} menyuntik periode_id`,
      state.ops[0]?.args[0]?.periode_id === "P1",
      JSON.stringify(state.ops[0]?.args[0])
    );
  }
}

console.log("4. User tidak bisa mengarahkan baris ke periode lain");
{
  const [b, state] = scoped("transaksi_keuangan", "P1");
  b.insert({ nominal: 1000, periode_id: "PERIODE_LAIN" });
  check("insert dipaksa ke P1", state.ops[0].args[0].periode_id === "P1");

  const [b2, state2] = scoped("laporan_harian", "P1");
  b2.update({ periode_id: "PERIODE_LAIN" }).eq("id", "abc");
  check("update dipaksa ke P1", state2.ops[0].args[0].periode_id === "P1");
}

console.log("5. update dan delete dibatasi ke periode terpilih");
{
  const [b, state] = scoped("transaksi_keuangan", "P1");
  b.update({ nominal: 1 }).eq("id", "abc");
  check(
    "update terfilter periode",
    hasPeriodFilter(state, "P1"),
    JSON.stringify(state.filters)
  );

  const [b2, state2] = scoped("kebutuhan", "P1");
  b2.delete().eq("id", "abc");
  check(
    "delete terfilter periode",
    hasPeriodFilter(state2, "P1"),
    JSON.stringify(state2.filters)
  );
}

console.log("6. Upsert saldo awal per periode");
{
  const [b, state] = scoped("saldo_awal", "P1");
  b.upsert({ nominal: 500 }, { onConflict: "periode_id" });
  check(
    "upsert saldo awal terisi periode_id",
    state.ops[0].args[0].periode_id === "P1",
    JSON.stringify(state.ops[0].args[0])
  );
  check(
    "upsert tetap meneruskan opsi onConflict",
    JSON.stringify(state.ops[0].args[1]) === JSON.stringify({ onConflict: "periode_id" }),
    JSON.stringify(state.ops[0].args[1])
  );
}

console.log("7. Mode semua-periode (super_admin) tidak memasang filter");
{
  const [b, state] = scoped("laporan_harian", null);
  b.select("*");
  check("baca tanpa filter", state.filters.length === 0, JSON.stringify(state.filters));
  check(
    "tidak pernah pakai nilai sentinel sebagai filter",
    !JSON.stringify(state).includes("semua-periode") &&
      !JSON.stringify(state).includes("__periode_aktif__")
  );
}

console.log("8. Rantai beberapa operasi tetap terkunci ke satu periode");
{
  const [b, state] = scoped("laporan_harian", "P1");
  b.select("*").eq("divisi_id", "D1").order("tanggal");
  check(
    "tidak ada operasi tanpa filter periode",
    hasPeriodFilter(state, "P1"),
    JSON.stringify(state.filters)
  );
  check(
    "filter milik user tetap ikut terbawa",
    state.filters.some(([c, v]) => c === "divisi_id" && v === "D1"),
    JSON.stringify(state.filters)
  );
  check(
    "filter periode hanya dipasang sekali",
    state.filters.filter(([c]) => c === "periode_id").length === 1,
    JSON.stringify(state.filters)
  );
}

console.log("9. Nilai sentinel dipetakan ke null oleh client scope");
{
  // setClientPeriodScope(null) berarti "semua periode"; sentinel aktif
  // hanya dipakai server sebelum di-resolve.
  const [b, state] = scoped("transaksi_keuangan", null);
  b.insert({ nominal: 1 });
  check(
    "tanpa periode tidak ada injeksi palsu",
    state.ops[0].args[0].periode_id === undefined,
    JSON.stringify(state.ops[0].args[0])
  );
}

console.log("10. REGRESI: .eq() tidak boleh dipanggil pada hasil .from()");
{
  // Ini yang dulu membuat /dashboard/admin balas HTTP 500 dengan
  // "TypeError: target.eq is not a function". `fakeBuilder` sengaja
  // tidak memberi `.eq()` ke queryBuilder, jadi implementasi salah
  // akan melempar exception di sini.
  let threw = null;
  try {
    const [b, state] = scoped("transaksi_keuangan", "P1");
    b.select("jenis_transaksi, nominal");
    check("select tanpa exception", true);
    check(
      "filter terpasang setelah select",
      hasPeriodFilter(state, "P1"),
      JSON.stringify(state.filters)
    );
  } catch (e) {
    threw = e;
    check("select tanpa exception", false, String(e));
  }

  if (!threw) {
    for (const method of ["insert", "update", "upsert", "delete"]) {
      let err = null;
      try {
        const [b] = scoped("transaksi_keuangan", "P1");
        if (method === "delete") b.delete();
        else b[method]({ nominal: 1 });
        check(`${method} tanpa exception`, true);
      } catch (e) {
        err = e;
        check(`${method} tanpa exception`, false, String(e));
      }
    }
  }
}

console.log("11. Menjalankan query (then) tetap memakai filter periode");
{
  const state = newState();
  const builder = scopeBuilderWithPeriod(
    fakeBuilder(state),
    "laporan_harian",
    "P1"
  );
  await builder.select("*");
  check(
    "query benar-benar dijalankan dengan filter periode",
    state.executions.length === 1 && hasPeriodFilter(state, "P1"),
    JSON.stringify(state.executions)
  );
}

console.log("");
console.log(`Hasil: ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);