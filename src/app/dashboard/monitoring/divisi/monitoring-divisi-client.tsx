"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Divisi, AnggotaDivisi } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { formatDate, todayISO } from "@/lib/date";
import { sortByJabatan } from "@/lib/jabatan";
import { Badge } from "@/components/ui/badge";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ExportMenu } from "@/components/export-menu";
import { Eye } from "lucide-react";

/** Baris anggota yang dibutuhkan tabel & modal "Lihat Anggota". */
type AnggotaRow = Pick<AnggotaDivisi, "id" | "divisi_id" | "nama" | "jabatan" | "status">;

/** Border seragam tiap sel: garis baris + kolom yang jelas. */
const CELL =
  "border-r border-b border-slate-200 whitespace-nowrap last:border-r-0 dark:border-slate-700/70";

export function MonitoringDivisiClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [divisiList, setDivisiList] = useState<
    Array<Divisi & { anggota: number; todayReport: boolean; lastReportDate: string | null; kendala: string; pemasukan: number; pengeluaran: number }>
  >([]);
  // Anggota per divisi: dipakai untuk jumlah pada tabel DAN modal,
  // sehingga angka jumlah selalu sama dengan daftar anggota (data asli).
  const [memberMap, setMemberMap] = useState<Record<string, AnggotaRow[]>>({});
  const [memberModal, setMemberModal] = useState<{ id: string; nama: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: div } = await supabase.from("divisi").select("*").order("nomor_divisi");
      const list = div ?? [];

      const today = todayISO();
      const { data: todayReports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal")
        .eq("tanggal", today);
      const todaySet = new Set(todayReports?.map((r) => r.divisi_id) ?? []);

      const { data: allReports } = await supabase
        .from("laporan_harian")
        .select("id, divisi_id, tanggal, kegiatan_hari_ini")
        .order("tanggal", { ascending: false });

      // per division last report
      const lastByDiv = new Map<string, { tanggal: string; kegiatan: string }>();
      (allReports ?? []).forEach((r) => {
        if (!lastByDiv.has(r.divisi_id)) {
          lastByDiv.set(r.divisi_id, { tanggal: r.tanggal, kegiatan: r.kegiatan_hari_ini });
        }
      });

      // Satu query untuk jumlah sekaligus daftar anggota (baca saja).
      const { data: anggota } = await supabase
        .from("anggota_divisi")
        .select("id, divisi_id, nama, jabatan, status");
      const membersByDiv: Record<string, AnggotaRow[]> = {};
      (anggota ?? []).forEach((a) => {
        (membersByDiv[a.divisi_id] ??= []).push(a);
      });

      const { data: kendala } = await supabase
        .from("kendala_solusi")
        .select("laporan_id, kendala")
        .order("created_at", { ascending: false });
      const laporanIdToDivisi = new Map<string, string>();
      (allReports ?? []).forEach((r) => laporanIdToDivisi.set(r.id, r.divisi_id));

      const kendalaLatest = new Map<string, string>();
      (kendala ?? []).forEach((k) => {
        const did = laporanIdToDivisi.get(k.laporan_id);
        if (did && !kendalaLatest.has(did)) kendalaLatest.set(did, k.kendala);
      });

      const { data: txs } = await supabase
        .from("transaksi_keuangan")
        .select("divisi_id, jenis_transaksi, nominal");
      const masuk = new Map<string, number>();
      const keluar = new Map<string, number>();
      (txs ?? []).forEach((t) => {
        const did = t.divisi_id;
        const n = Number(t.nominal) || 0;
        if (t.jenis_transaksi === "pemasukan")
          masuk.set(did, (masuk.get(did) ?? 0) + n);
        else keluar.set(did, (keluar.get(did) ?? 0) + n);
      });

      const enriched = list.map((d) => {
        const last = lastByDiv.get(d.id);
        return {
          ...d,
          anggota: (membersByDiv[d.id] ?? []).length,
          todayReport: todaySet.has(d.id),
          lastReportDate: last?.tanggal ?? null,
          kendala: kendalaLatest.get(d.id) ?? "",
          pemasukan: masuk.get(d.id) ?? 0,
          pengeluaran: keluar.get(d.id) ?? 0,
        };
      });

      setMemberMap(membersByDiv);
      setDivisiList(enriched);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner />;

  const modalMembers = memberModal ? sortByJabatan(memberMap[memberModal.id] ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Semua Divisi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pantau 20 divisi OSIS</p>
        </div>
        <ExportMenu
          title="Data Divisi"
          filename="data-divisi"
          disabled={divisiList.length === 0}
          columns={[
            { header: "Divisi", key: "divisi", width: 20 },
            { header: "Ketua", key: "ketua", width: 20 },
            { header: "Wakil", key: "wakil", width: 20 },
            { header: "Anggota", key: "anggota", width: 10 },
            { header: "Laporan Hari Ini", key: "laporan_hari_ini", width: 16 },
            { header: "Laporan Terakhir", key: "laporan_terakhir", width: 14 },
            { header: "Kendala Terbaru", key: "kendala", width: 30 },
            { header: "Saldo", key: "saldo", width: 20, align: "right" },
          ]}
          rows={divisiList.map((d) => ({
            divisi: d.nama_divisi,
            ketua: d.ketua_divisi ?? "-",
            wakil: d.wakil_divisi ?? "-",
            anggota: d.anggota,
            laporan_hari_ini: d.todayReport ? "Sudah Mengisi" : "Belum Mengisi",
            laporan_terakhir: d.lastReportDate ? formatDate(d.lastReportDate) : "-",
            kendala: d.kendala || "-",
            saldo: formatRupiah(d.pemasukan - d.pengeluaran),
          }))}
        />
      </div>

      {/* Tabel per divisi: garis baris & kolom jelas, spasi rapi,
          teks tidak tumpang tindih, dan geser horizontal bila lebar. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <TableWrap minWidth={1240}>
          <THead>
            <tr>
              <TH className={CELL}>Divisi</TH>
              <TH className={CELL}>Ketua</TH>
              <TH className={CELL}>Wakil</TH>
              <TH className={CELL} align="center">Anggota</TH>
              <TH className={CELL}>Laporan Hari Ini</TH>
              <TH className={CELL}>Laporan Terakhir</TH>
              <TH className={CELL}>Kendala Terbaru</TH>
              <TH className={CELL} align="right">Saldo</TH>
              <TH className={CELL} align="center">Aksi</TH>
            </tr>
          </THead>
          <TBody>
            {divisiList.map((d) => (
              <TR key={d.id}>
                <TD className={`${CELL} font-medium text-slate-900 dark:text-white`}>
                  {d.nama_divisi}
                </TD>
                <TD className={CELL}>{d.ketua_divisi || "-"}</TD>
                <TD className={CELL}>{d.wakil_divisi || "-"}</TD>
                <TD className={`${CELL} text-center font-semibold`} align="center">
                  {d.anggota}
                </TD>
                <TD className={CELL}>
                  {d.todayReport ? (
                    <Badge color="green">Sudah Mengisi</Badge>
                  ) : (
                    <Badge color="red">Belum Mengisi</Badge>
                  )}
                </TD>
                <TD className={CELL}>
                  {d.lastReportDate ? formatDate(d.lastReportDate) : "-"}
                </TD>
                <TD className="border-r border-b border-slate-200 px-4 py-3 align-middle last:border-r-0 dark:border-slate-700/70">
                  <span className="block w-[190px] truncate" title={d.kendala || undefined}>
                    {d.kendala || "-"}
                  </span>
                </TD>
                <TD className={`${CELL} text-right font-medium`} align="right">
                  {formatRupiah(d.pemasukan - d.pengeluaran)}
                </TD>
                <TD className={`${CELL} text-center`} align="center">
                  <button
                    type="button"
                    onClick={() => setMemberModal({ id: d.id, nama: d.nama_divisi })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-3 w-3 text-slate-400" />
                    <span>Lihat Anggota</span>
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </TableWrap>
      </div>

      {/* Modal Anggota: hanya baca — tanpa ubah/hapus/ganti status.
          Daftar & jumlah berasal dari baris `anggota_divisi` yang sama. */}
      <Modal
        open={memberModal !== null}
        onClose={() => setMemberModal(null)}
        title={memberModal ? `Anggota ${memberModal.nama}` : "Anggota Divisi"}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Data yang diisi ketua divisi. Total{" "}
            <strong className="text-slate-800 dark:text-slate-200">
              {modalMembers.length} anggota
            </strong>{" "}
            — tampilan baca saja.
          </p>

          {modalMembers.length === 0 ? (
            <EmptyState
              title="Belum ada anggota"
              description="Ketua divisi ini belum mengisi data anggota."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <TableWrap minWidth={520}>
                <THead>
                  <tr>
                    <TH className={CELL}>Nama</TH>
                    <TH className={CELL}>Jabatan / Posisi</TH>
                    <TH className={CELL} align="center">Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {modalMembers.map((a) => (
                    <TR key={a.id}>
                      <TD className={`${CELL} font-medium text-slate-900 dark:text-white`}>
                        {a.nama}
                      </TD>
                      <TD className={CELL}>{a.jabatan || "-"}</TD>
                      <TD className={CELL} align="center">
                        <Badge color={a.status === "aktif" ? "green" : "slate"} dot>
                          {a.status === "aktif"
                            ? "Aktif"
                            : a.status === "nonaktif"
                              ? "Nonaktif"
                              : a.status || "-"}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
