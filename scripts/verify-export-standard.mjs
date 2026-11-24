/**
 * Verifikasi standar dokumen resmi OSIS.
 * Menyusun modul ekspor ke CommonJS, membuat PDF/DOCX/XLSX contoh, lalu
 * memeriksa struktur, ringkasan hasil hitungan, pengesahan, dan footer.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const verifyDir = path.join(root, ".verify");
const compiled = path.join(verifyDir, "export-client.js");

let pass = 0;
let fail = 0;
function check(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  LULUS  ${name}`);
  } else {
    fail += 1;
    console.error(`  GAGAL  ${name}${detail ? " - " + detail : ""}`);
  }
}

execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "src/lib/export-document.ts",
    "src/lib/export-client.ts",
    "src/lib/docx-writer.ts",
    "src/lib/school-config.ts",
    "--outDir", ".verify",
    "--module", "commonjs",
    "--target", "es2020",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck",
  ],
  { cwd: root, stdio: "inherit" }
);

if (!existsSync(compiled)) {
  console.error("Modul ekspor hasil kompilasi tidak ditemukan.");
  process.exit(2);
}

const require = createRequire(import.meta.url);
const { buildExportBlob } = require(compiled);
const { computeSummary, parseNumeric, resolveApproval, resolveDocumentType } = require(
  path.join(verifyDir, "export-document.js")
);
const JSZip = require("jszip");
const ExcelJS = require("exceljs");

const kop = {
  organization: "ORGANISASI SISWA INTRA SEKOLAH (OSIS)",
  namaSekolah: "SMA NEGERI CONTOH",
  alamat: "Jalan Pendidikan No. 1",
  ketuaOsis: "Nama Ketua OSIS",
  bendaharaOsis: "Nama Bendahara OSIS",
  pembinaOsis: "Nama Pembina OSIS",
};

const columns = [
  { header: "Tanggal", key: "tanggal", width: 14 },
  { header: "Kegiatan dengan keterangan panjang yang harus dibungkus", key: "kegiatan", width: 30 },
  { header: "Nominal", key: "nominal", width: 16, align: "right" },
];
const rows = Array.from({ length: 40 }, (_, i) => ({
  tanggal: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`,
  kegiatan: `Kegiatan ke-${i + 1} dengan penjelasan yang sengaja dibuat panjang untuk menguji pembungkusan teks pada tiga format ekspor sekaligus.`,
  nominal: `Rp ${(1000 * (i + 1)).toLocaleString("id-ID")}`,
}));
rows.push({ tanggal: "TOTAL", nominal: "Rp 820.000", __total: true });

const base = {
  title: "Laporan Keuangan Divisi",
  subtitle: "Divisi: Keuangan · Periode: 2026/2027",
  periodLabel: "2026/2027",
  division: "Divisi Keuangan",
  columns,
  rows,
  filename: "laporan-keuangan",
  kop,
  notes: ["Keterangan panjang dari database tetap dipertahankan pada bagian keterangan."],
};

console.log("\n[1] Ringkasan & kewenangan dihitung dari data");
check("parse Rupiah Indonesia", parseNumeric("Rp 1.234.567") === 1234567);
check("parse angka negatif", parseNumeric("-Rp 500") === -500);
const summary = computeSummary(columns, rows);
check(
  "jumlah entri dihitung dari baris data",
  summary.some((s) => s.label === "Jumlah data" && s.value.includes("40"))
);
check(
  "total nominal dihitung dari data, bukan baris TOTAL",
  summary.some((s) => s.label === "Total Nominal" && s.value.includes("820.000"))
);
check(
  "baris __total tidak dijumlahkan dua kali",
  !summary.some((s) => s.label === "Total Nominal" && s.value.includes("1.640.000"))
);
check(
  "pengesahan keuangan memakai Bendahara & Ketua OSIS",
  resolveApproval(base.title, kop).signatories.some((s) => s.name === "Nama Bendahara OSIS")
);
check(
  "jenis dokumen mengikuti judul",
  resolveDocumentType("Rekap Keuangan Bulanan") === "REKAPITULASI"
);

console.log("\n[2] PDF");
const pdfResult = await buildExportBlob({ ...base, format: "pdf" });
const pdf = Buffer.from(await pdfResult.blob.arrayBuffer()).toString("latin1");
check("ekstensi pdf", pdfResult.ext === "pdf");
check("versi PDF 1.4", pdf.startsWith("%PDF-1.4"));
check("kertas A4", pdf.includes("595.28") || pdf.includes("841.89"));
check("kop LAPORAN HARIAN tercetak", pdf.includes("LAPORAN HARIAN"));
check("kop IP4A tercetak", pdf.includes("PENGURUS DIVISI") && (pdf.includes("(IP4A)") || pdf.includes("IP4A")));
check("struktur ringkasan/keterangan/pengesahan", ["RINGKASAN", "KETERANGAN", "PENGESAHAN"].every((s) => pdf.includes(s)));
check("nomor halaman X dari Y", /Halaman 1 dari \d+/.test(pdf));
check("tabel berpindah halaman", /\/Count [2-9]/.test(pdf));
check("header tabel diulang", (pdf.match(/Tanggal/g) || []).length >= 2);
const pdfOrder = ["DATA LAPORAN", "RINGKASAN", "KETERANGAN", "PENGESAHAN"].map((s) => pdf.indexOf(s));
check("hierarki isi → ringkasan → keterangan → pengesahan", pdfOrder.every((n, i) => n >= 0 && (i === 0 || n > pdfOrder[i - 1])));

console.log("\n[3] DOCX");
const docResult = await buildExportBlob({ ...base, format: "doc" });
check("ekstensi docx", docResult.ext === "docx");
const zip = await JSZip.loadAsync(await docResult.blob.arrayBuffer());
const names = Object.keys(zip.files);
check("paket OOXML valid", ["[Content_Types].xml", "word/document.xml", "word/footer1.xml", "word/styles.xml"].every((n) => names.includes(n)));
const documentXml = await zip.file("word/document.xml").async("string");
const footerXml = await zip.file("word/footer1.xml").async("string");
check("tabel Word asli dapat diedit", documentXml.includes("<w:tbl>") && documentXml.includes("<w:tblHeader/>"));
check("kop & bagian laporan lengkap", ["LAPORAN HARIAN", "PENGURUS DIVISI", "IP4A", "RINGKASAN", "KETERANGAN", "PENGESAHAN"].every((s) => documentXml.includes(s)));
check("field PAGE dan NUMPAGES", footerXml.includes('w:instr=" PAGE "') && footerXml.includes('w:instr=" NUMPAGES "'));
check("footer identitas IP4A", footerXml.includes("IP4A Pondok Pesantren Al-Ittihad"));
check("ukuran kertas A4", documentXml.includes('w:w="11906"'));
const docOrder = ["DATA LAPORAN", "RINGKASAN", "KETERANGAN", "PENGESAHAN"].map((s) => documentXml.indexOf(s));
check("hierarki DOCX sesuai standar", docOrder.every((n, i) => n >= 0 && (i === 0 || n > docOrder[i - 1])));

console.log("\n[4] XLSX");
const excelResult = await buildExportBlob({ ...base, format: "excel" });
check("ekstensi xlsx", excelResult.ext === "xlsx");
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await excelResult.blob.arrayBuffer());
const ws = wb.worksheets[0];
check("freeze panes aktif", Boolean(ws.views?.[0]?.ySplit && ws.views[0].ySplit > 1));
check("auto filter aktif", Boolean(ws.autoFilter));
check("print area diatur", Boolean(ws.pageSetup?.printArea));
check("kertas A4 & orientasi", ws.pageSetup?.paperSize === 9 && Boolean(ws.pageSetup?.orientation));
check("footer & nomor halaman", String(ws.headerFooter?.oddFooter ?? "").includes("Halaman &P dari &N"));
const allText = ws.getRows(1, ws.rowCount).flatMap((row) => row.values ?? []).map((v) => String(v ?? "")).join(" ");
check("data tidak hilang", allText.includes("Kegiatan ke-40") && allText.includes("Kegiatan ke-1"));
check("ringkasan & pengesahan tercetak", allText.includes("RINGKASAN") && allText.includes("PENGESAHAN"));
const xlsxOrder = ["DATA LAPORAN", "RINGKASAN", "KETERANGAN", "PENGESAHAN"].map((label) =>
  ws.getRows(1, ws.rowCount).findIndex((row) =>
    (row.values ?? []).some((v) => typeof v === "string" && v.startsWith(label))
  )
);
check("hierarki XLSX sesuai standar", xlsxOrder.every((n, i) => n >= 0 && (i === 0 || n > xlsxOrder[i - 1])));
let hasWrapText = false;
for (let r = 1; r <= ws.rowCount; r++) {
  for (let c = 1; c <= ws.columnCount; c++) {
    if (ws.getCell(r, c).alignment?.wrapText) hasWrapText = true;
  }
}
check("wrap text aktif", hasWrapText);

console.log("\n[5] Kasus tepi: data kosong & logo terkonfigurasi");
const emptyPdf = await buildExportBlob({
  ...base,
  rows: [],
  format: "pdf",
});
const emptyText = Buffer.from(await emptyPdf.blob.arrayBuffer()).toString("latin1");
check("data kosong tidak menghasilkan halaman kosong", /\/Count 1\b/.test(emptyText));
check("data kosong tetap memuat kop & pengesahan", emptyText.includes("LAPORAN HARIAN") && emptyText.includes("PENGESAHAN"));

const pngBase64 = readFileSync(path.join(root, "public", "logo_osis.png")).toString("base64");
const pngDataUrl = `data:image/png;base64,${pngBase64}`;
const withLogo = {
  ...base,
  rows: rows.slice(0, 3),
  kopLogos: {
    left: { dataUrl: pngDataUrl, width: 1098, height: 1433, mimeType: "image/png" },
    right: { dataUrl: pngDataUrl, width: 1098, height: 1433, mimeType: "image/png" },
  },
};
const logoPdf = await buildExportBlob({ ...withLogo, format: "pdf" });
const logoDoc = await buildExportBlob({ ...withLogo, format: "doc" });
const logoExcel = await buildExportBlob({ ...withLogo, format: "excel" });
check("logo tertanam di PDF", Buffer.from(await logoPdf.blob.arrayBuffer()).toString("latin1").includes("/Subtype /Image"));
const logoZip = await JSZip.loadAsync(await logoDoc.blob.arrayBuffer());
check("logo PNG tertanam di DOCX", Boolean(logoZip.file("word/media/logo-left.png") && logoZip.file("word/media/logo-right.png")));
const logoWb = new ExcelJS.Workbook();
await logoWb.xlsx.load(await logoExcel.blob.arrayBuffer());
check("logo kiri/kanan tertanam di XLSX", logoWb.worksheets[0].getImages().length === 2);

console.log("\n[6] Tabel banyak kolom (orientasi landscape otomatis)");
const wideColumns = Array.from({ length: 8 }, (_, i) => ({
  header: `Kolom ${i + 1} dengan judul panjang`,
  key: `k${i}`,
  width: 10 + i,
}));
const wideRows = Array.from({ length: 5 }, (_, r) =>
  Object.fromEntries(wideColumns.map((c, i) => [c.key, `Data baris ${r + 1} kolom ${i + 1}`]))
);
const wideBase = { ...base, columns: wideColumns, rows: wideRows, orientation: "auto" };
const widePdf = await buildExportBlob({ ...wideBase, format: "pdf" });
const wideDoc = await buildExportBlob({ ...wideBase, format: "doc" });
const wideExcel = await buildExportBlob({ ...wideBase, format: "excel" });
check("PDF landscape A4", Buffer.from(await widePdf.blob.arrayBuffer()).toString("latin1").includes("841.89 595.28"));
const wideZip = await JSZip.loadAsync(await wideDoc.blob.arrayBuffer());
check("DOCX landscape A4", (await wideZip.file("word/document.xml").async("string")).includes('w:orient="landscape"'));
const wideWb = new ExcelJS.Workbook();
await wideWb.xlsx.load(await wideExcel.blob.arrayBuffer());
check("XLSX landscape", wideWb.worksheets[0].pageSetup?.orientation === "landscape");

console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
