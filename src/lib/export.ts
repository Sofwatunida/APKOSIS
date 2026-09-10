import ExcelJS from "exceljs";
import { createClient } from "./supabase/server";
import { formatRupiahPlain } from "./format";
import type { Database } from "./database.types";

type LaporanRow = Database["public"]["Tables"]["laporan_harian"]["Row"];
type KendalaRow = Database["public"]["Tables"]["kendala_solusi"]["Row"];
type AnggotaRow = Database["public"]["Tables"]["anggota_divisi"]["Row"];
type InventarisRow = Database["public"]["Tables"]["inventaris"]["Row"];
type KebutuhanRow = Database["public"]["Tables"]["kebutuhan"]["Row"];
type TransaksiRow = Database["public"]["Tables"]["transaksi_keuangan"]["Row"];
type DivisiRow = Database["public"]["Tables"]["divisi"]["Row"];

export interface AdministrasiExportData {
  divisi: DivisiRow[];
  laporan: Array<LaporanRow & { nama_divisi: string }>;
  kendala: Array<KendalaRow & { nama_divisi: string; tanggal: string }>;
  anggota: Array<AnggotaRow & { nama_divisi: string }>;
  inventaris: Array<InventarisRow & { nama_divisi: string }>;
  kebutuhan: Array<KebutuhanRow & { nama_divisi: string }>;
  keuangan: Array<TransaksiRow & { nama_divisi: string }>;
}

function styleHeader(ws: ExcelJS.Worksheet, columns: number, title?: string) {
  if (title) {
    const tRow = ws.getRow(1);
    tRow.getCell(1).value = title;
    tRow.font = { bold: true, size: 14 };
    ws.mergeCells(1, 1, 1, columns);
  }
  const headerRow = ws.getRow(title ? 2 : 1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4F46E5" } };
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 22;
}

export async function buildAdministrasiWorkbook(
  data: AdministrasiExportData
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Ringkasan
  const ringkas = wb.addWorksheet("Ringkasan");
  ringkas.columns = [
    { header: "Divisi", key: "divisi", width: 20 },
    { header: "Ketua", key: "ketua", width: 20 },
    { header: "Wakil", key: "wakil", width: 20 },
    { header: "Periode", key: "periode", width: 12 },
    { header: "Jumlah Anggota", key: "anggota", width: 15 },
    { header: "Jumlah Laporan", key: "laporan", width: 15 },
  ];
  const anggotaPerDiv = new Map<string, number>();
  data.anggota.forEach((a) =>
    anggotaPerDiv.set(a.divisi_id, (anggotaPerDiv.get(a.divisi_id) ?? 0) + 1)
  );
  const laporanPerDiv = new Map<string, number>();
  data.laporan.forEach((l) =>
    laporanPerDiv.set(l.divisi_id, (laporanPerDiv.get(l.divisi_id) ?? 0) + 1)
  );
  data.divisi.forEach((d) => {
    ringkas.addRow({
      divisi: d.nama_divisi,
      ketua: d.ketua_divisi ?? "-",
      wakil: d.wakil_divisi ?? "-",
      periode: d.periode ?? "-",
      anggota: anggotaPerDiv.get(d.id) ?? 0,
      laporan: laporanPerDiv.get(d.id) ?? 0,
    });
  });
  styleHeader(ringkas, 6, "APKOSIS - Ringkasan");

  function buildSheet(
    name: string,
    columns: Partial<ExcelJS.Column>[],
    rows: Record<string, unknown>[],
    title?: string
  ) {
    const ws = wb.addWorksheet(name);
    ws.columns = columns;
    rows.forEach((r) => ws.addRow(r));
    styleHeader(ws, columns.length, title);
    ws.views = [{ state: "frozen", ySplit: title ? 2 : 1 }];
    return ws;
  }

  buildSheet(
    "Laporan Harian",
    [
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Divisi", key: "divisi", width: 0 },
      { header: "Kegiatan Hari Ini", key: "kegiatan", width: 40 },
      { header: "Informasi Lain", key: "informasi", width: 30 },
      { header: "Penerima", key: "penerima", width: 15 },
    ],
    data.laporan.map((l) => ({
      tanggal: l.tanggal,
      nama_divisi: l.nama_divisi,
      kegiatan: l.kegiatan_hari_ini,
      informasi: l.informasi_lain ?? "",
      penerima: l.penerima_laporan ?? "",
    })),
    "APKOSIS - Laporan Harian"
  );

  buildSheet(
    "Kendala & Solusi",
    [
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Kendala", key: "kendala", width: 35 },
      { header: "Solusi", key: "solusi", width: 35 },
    ],
    data.kendala.map((k) => ({
      tanggal: k.tanggal,
      nama_divisi: k.nama_divisi,
      kendala: k.kendala,
      solusi: k.solusi,
    })),
    "APKOSIS - Kendala & Solusi"
  );

  buildSheet(
    "Anggota",
    [
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Nama", key: "nama", width: 25 },
      { header: "Jabatan", key: "jabatan", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ],
    data.anggota.map((a) => ({
      nama_divisi: a.nama_divisi,
      nama: a.nama,
      jabatan: a.jabatan ?? "",
      status: a.status,
    })),
    "APKOSIS - Anggota"
  );

  buildSheet(
    "Inventaris",
    [
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Nama Barang", key: "nama_barang", width: 25 },
      { header: "Jumlah", key: "jumlah", width: 10 },
      { header: "Kondisi", key: "kondisi", width: 15 },
      { header: "Keterangan", key: "keterangan", width: 25 },
    ],
    data.inventaris.map((i) => ({
      nama_divisi: i.nama_divisi,
      nama_barang: i.nama_barang,
      jumlah: i.jumlah ?? "",
      kondisi: i.kondisi ?? "",
      keterangan: i.keterangan ?? "",
    })),
    "APKOSIS - Inventaris"
  );

  buildSheet(
    "Kebutuhan",
    [
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Kebutuhan", key: "nama_kebutuhan", width: 25 },
      { header: "Jumlah", key: "jumlah", width: 10 },
      { header: "Status Pembelian", key: "status", width: 18 },
      { header: "Keterangan", key: "keterangan", width: 25 },
    ],
    data.kebutuhan.map((k) => ({
      nama_divisi: k.nama_divisi,
      nama_kebutuhan: k.nama_kebutuhan,
      jumlah: k.jumlah ?? "",
      status: k.status_pembelian,
      keterangan: k.keterangan ?? "",
    })),
    "APKOSIS - Kebutuhan"
  );

  buildSheet(
    "Keuangan",
    [
      { header: "Tanggal", key: "tanggal", width: 14 },
      { header: "Divisi", key: "nama_divisi", width: 20 },
      { header: "Jenis", key: "jenis", width: 14 },
      { header: "Keterangan", key: "keterangan", width: 30 },
      { header: "Nominal", key: "nominal", width: 18 },
    ],
    data.keuangan.map((t) => ({
      tanggal: t.tanggal,
      nama_divisi: t.nama_divisi,
      jenis: t.jenis_transaksi,
      keterangan: t.keterangan,
      nominal: formatRupiahPlain(t.nominal),
    })),
    "APKOSIS - Keuangan"
  );

  return wb;
}

export async function buildKeuanganWorkbook(
  divisi: DivisiRow[],
  transaksi: Array<TransaksiRow & { nama_divisi: string }>
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();

  const ringkas = wb.addWorksheet("Rekap Divisi");
  ringkas.columns = [
    { header: "Divisi", key: "divisi", width: 20 },
    { header: "Pemasukan", key: "masuk", width: 20 },
    { header: "Pengeluaran", key: "keluar", width: 20 },
    { header: "Saldo", key: "saldo", width: 20 },
  ];
  const perDiv = new Map<string, { masuk: number; keluar: number }>();
  transaksi.forEach((t) => {
    const n = Number(t.nominal) || 0;
    if (!perDiv.has(t.divisi_id)) perDiv.set(t.divisi_id, { masuk: 0, keluar: 0 });
    const cur = perDiv.get(t.divisi_id)!;
    if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
    else cur.keluar += n;
  });
  divisi.forEach((d) => {
    const f = perDiv.get(d.id) ?? { masuk: 0, keluar: 0 };
    ringkas.addRow({
      divisi: d.nama_divisi,
      masuk: formatRupiahPlain(f.masuk),
      keluar: formatRupiahPlain(f.keluar),
      saldo: formatRupiahPlain(f.masuk - f.keluar),
    });
  });
  styleHeader(ringkas, 4, "APKOSIS - Rekap Keuangan per Divisi");
  ringkas.views = [{ state: "frozen", ySplit: 2 }];

  const details = wb.addWorksheet("Transaksi");
  details.columns = [
    { header: "Tanggal", key: "tanggal", width: 14 },
    { header: "Divisi", key: "divisi", width: 24 },
    { header: "Jenis", key: "jenis", width: 14 },
    { header: "Keterangan", key: "keterangan", width: 35 },
    { header: "Nominal", key: "nominal", width: 20 },
  ];
  transaksi
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .forEach((t) => {
      details.addRow({
        tanggal: t.tanggal,
        divisi: t.nama_divisi,
        jenis: t.jenis_transaksi,
        keterangan: t.keterangan,
        nominal: formatRupiahPlain(t.nominal),
      });
    });
  styleHeader(details, 5, "APKOSIS - Transaksi Keuangan");
  details.views = [{ state: "frozen", ySplit: 2 }];

  const bulanan = wb.addWorksheet("Rekap Bulanan");
  bulanan.columns = [
    { header: "Bulan", key: "bulan", width: 16 },
    { header: "Pemasukan", key: "masuk", width: 20 },
    { header: "Pengeluaran", key: "keluar", width: 20 },
    { header: "Saldo", key: "saldo", width: 20 },
  ];
  const byMonth = new Map<string, { masuk: number; keluar: number }>();
  transaksi.forEach((t) => {
    const key = t.tanggal.slice(0, 7);
    const n = Number(t.nominal) || 0;
    if (!byMonth.has(key)) byMonth.set(key, { masuk: 0, keluar: 0 });
    const cur = byMonth.get(key)!;
    if (t.jenis_transaksi === "pemasukan") cur.masuk += n;
    else cur.keluar += n;
  });
  [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([key, f]) => {
      bulanan.addRow({
        bulan: key,
        masuk: formatRupiahPlain(f.masuk),
        keluar: formatRupiahPlain(f.keluar),
        saldo: formatRupiahPlain(f.masuk - f.keluar),
      });
    });
  styleHeader(bulanan, 4, "APKOSIS - Rekap Keuangan Bulanan");
  bulanan.views = [{ state: "frozen", ySplit: 2 }];

  return wb;
}

export async function fetchAdministrasiData(
  filters?: { divisi_id?: string | null; month?: string | null; year?: string | null }
): Promise<AdministrasiExportData> {
  const supabase = await createClient();

  const { data: divisi } = await supabase.from("divisi").select("*").order("nomor_divisi");
  const { data: laporan } = await supabase
    .from("laporan_harian")
    .select("*, divisi(nama_divisi)")
    .order("tanggal", { ascending: false });
  const { data: kendala } = await supabase
    .from("kendala_solusi")
    .select("*, laporan_harian(divisi_id, tanggal)");
  const { data: anggota } = await supabase.from("anggota_divisi").select("*, divisi(nama_divisi)");
  const { data: inventaris } = await supabase.from("inventaris").select("*, divisi(nama_divisi)");
  const { data: kebutuhan } = await supabase.from("kebutuhan").select("*, divisi(nama_divisi)");
  const { data: keuangan } = await supabase
    .from("transaksi_keuangan")
    .select("*, divisi(nama_divisi)")
    .order("tanggal", { ascending: false });

  const divMap = new Map((divisi ?? []).map((d) => [d.id, d.nama_divisi]));

  return {
    divisi: divisi ?? [],
    laporan: (laporan ?? []).map((l: any) => ({
      ...l,
      nama_divisi: l.divisi?.nama_divisi ?? divMap.get(l.divisi_id) ?? "-",
    })),
    kendala: (kendala ?? []).map((k: any) => ({
      ...k,
      tanggal: k.laporan_harian?.tanggal ?? "",
      nama_divisi: divMap.get(k.laporan_harian?.divisi_id) ?? "-",
    })),
    anggota: (anggota ?? []).map((a: any) => ({
      ...a,
      nama_divisi: a.divisi?.nama_divisi ?? divMap.get(a.divisi_id) ?? "-",
    })),
    inventaris: (inventaris ?? []).map((i: any) => ({
      ...i,
      nama_divisi: i.divisi?.nama_divisi ?? divMap.get(i.divisi_id) ?? "-",
    })),
    kebutuhan: (kebutuhan ?? []).map((k: any) => ({
      ...k,
      nama_divisi: k.divisi?.nama_divisi ?? divMap.get(k.divisi_id) ?? "-",
    })),
    keuangan: (keuangan ?? []).map((t: any) => ({
      ...t,
      nama_divisi: t.divisi?.nama_divisi ?? divMap.get(t.divisi_id) ?? "-",
    })),
  };
}
