"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  fetchPengajuanDanaDetail,
  STATUS_PERSETUJUAN_LABEL,
  STATUS_PERSETUJUAN_COLOR,
  STATUS_PENGAMBILAN_LABEL,
  STATUS_PENGAMBILAN_COLOR,
  type PengajuanDanaDetail,
} from "@/lib/pengajuan-dana";
import { formatDate } from "@/lib/date";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ExportMenu } from "@/components/export-menu";
import { HandCoins, Check, X, Wallet, Trash2, Info } from "lucide-react";

export function PengajuanDanaBendaharaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PengajuanDanaDetail[]>([]);
  const [divisiOptions, setDivisiOptions] = useState<
    { id: string; nama_divisi: string }[]
  >([]);
  const [filterDivisi, setFilterDivisi] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<{
    target: PengajuanDanaDetail;
    aksi: "setujui" | "tolak" | "diambil" | "hapus";
  } | null>(null);

  async function load() {
    try {
      const rows = await fetchPengajuanDanaDetail(supabase);
      setItems(rows);
      const { data: divisi } = await supabase
        .from("divisi")
        .select("id, nama_divisi")
        .order("nama_divisi", { ascending: true });
      setDivisiOptions(divisi ?? []);
    } catch {
      error("Gagal memuat data pengajuan dana.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        if (filterDivisi && p.divisi_id !== filterDivisi) return false;
        if (filterStatus) {
          if (filterStatus === "perlu_tindakan")
            return p.status_persetujuan === "belum" || p.status_pengambilan === "belum";
          if (filterStatus === "selesai")
            return p.status_persetujuan === "disetujui" && p.status_pengambilan === "sudah_diambil";
        }
        return true;
      }),
    [items, filterDivisi, filterStatus]
  );

  const rekap = useMemo(() => {
    const menunggu = items.filter((p) => p.status_persetujuan === "belum").length;
    const menungguUang = items.filter(
      (p) => p.status_persetujuan === "disetujui" && p.status_pengambilan === "belum"
    ).length;
    const selesai = items.filter(
      (p) => p.status_persetujuan === "disetujui" && p.status_pengambilan === "sudah_diambil"
    ).length;
    const nominalMenungguUang = items
      .filter((p) => p.status_persetujuan === "disetujui" && p.status_pengambilan === "belum")
      .reduce((s, p) => s + p.nominal, 0);
    return { menunggu, menungguUang, selesai, nominalMenungguUang };
  }, [items]);

  /**
   * Semua perubahan status dilakukan lewat UPDATE pada tabel pengajuan_dana.
   * Database (RLS + trigger) yang menjadi penjaga aturan:
   *  - hanya Bendahara boleh update,
   *  - "sudah_diambil" hanya boleh bila sudah "disetujui",
   *  - approved_at/taken_at dicatat otomatis.
   */
  async function jalankanAksi() {
    if (!konfirmasi) return;
    const { target, aksi } = konfirmasi;
    setBusyId(target.id);

    let update:
      | {
          status_persetujuan?: "belum" | "disetujui";
          status_pengambilan?: "belum" | "sudah_diambil";
        }
      | null = null;

    if (aksi === "setujui") update = { status_persetujuan: "disetujui" };
    if (aksi === "tolak") update = { status_persetujuan: "belum" };
    if (aksi === "diambil") update = { status_pengambilan: "sudah_diambil" };

    if (update) {
      const { error: upErr } = await supabase
        .from("pengajuan_dana")
        .update(update)
        .eq("id", target.id);
      setBusyId(null);
      if (upErr) {
        error("Gagal memperbarui pengajuan: " + upErr.message);
        return;
      }
      const pesan =
        aksi === "setujui"
          ? "Pengajuan disetujui."
          : aksi === "tolak"
          ? "Persetujuan dicabut."
          : "Pengajuan ditandai sudah diambil.";
      success(pesan);
    } else {
      const { error: delErr } = await supabase
        .from("pengajuan_dana")
        .delete()
        .eq("id", target.id);
      setBusyId(null);
      if (delErr) {
        error("Gagal menghapus pengajuan: " + delErr.message);
        return;
      }
      success("Pengajuan dihapus.");
    }

    setKonfirmasi(null);
    await load();
  }

  if (loading) return <Spinner />;

  const judulKonfirmasi = {
    setujui: "Setujui Pengajuan Dana",
    tolak: "Cabut Persetujuan",
    diambil: "Tandai Sudah Diambil",
    hapus: "Hapus Pengajuan",
  }[konfirmasi?.aksi ?? "setujui"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pengajuan Dana
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola persetujuan &amp; pengambilan dana seluruh divisi
          </p>
        </div>
        <ExportMenu
          title="Pengajuan Dana"
          subtitle="Seluruh divisi"
          filename="pengajuan-dana-bendahara"
          disabled={filtered.length === 0}
          columns={[
            { header: "Tanggal", key: "tanggal", width: 13 },
            { header: "Divisi", key: "divisi", width: 18 },
            { header: "Kebutuhan", key: "kebutuhan", width: 24 },
            { header: "Pengaju", key: "pengaju", width: 18 },
            { header: "Nominal", key: "nominal", width: 15 },
            { header: "Persetujuan", key: "persetujuan", width: 14 },
            { header: "Pengambilan", key: "pengambilan", width: 14 },
          ]}
          rows={filtered.map((p) => ({
            tanggal: formatDate(p.tanggal_pengajuan),
            divisi: p.nama_divisi,
            kebutuhan: p.nama_kebutuhan ?? "-",
            pengaju: p.nama_pengaju,
            nominal: formatRupiah(p.nominal),
            persetujuan: STATUS_PERSETUJUAN_LABEL[p.status_persetujuan],
            pengambilan: STATUS_PENGAMBILAN_LABEL[p.status_pengambilan],
          }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Menunggu Persetujuan
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-300">
            {rekap.menunggu}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-400">
            Disetujui, Belum Diambil
          </p>
          <p className="mt-1 text-2xl font-bold text-sky-900 dark:text-sky-300">
            {rekap.menungguUang}
          </p>
          <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
            {formatRupiah(rekap.nominalMenungguUang)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Selesai
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-300">
            {rekap.selesai}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Pengajuan
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {items.length}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Uang hanya bisa ditandai <strong>sudah diambil</strong> setelah
          pengajuan disetujui. Setelah diambil, status kebutuhan terkait otomatis
          ditandai <strong>Sudah Dipenuhi</strong> oleh sistem.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Daftar Pengajuan"
          subtitle={`${filtered.length} dari ${items.length} pengajuan`}
          icon={<HandCoins className="h-5 w-5" />}
          action={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={filterDivisi}
                onChange={(e) => setFilterDivisi(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">Semua Divisi</option>
                {divisiOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama_divisi}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="">Semua Status</option>
                <option value="perlu_tindakan">Perlu Tindakan</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          }
        />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              title="Tidak ada pengajuan"
              description="Pengajuan dana yang dikirim divisi akan muncul di sini."
            />
          ) : (
            <TableWrap minWidth={1100}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Divisi</TH>
                  <TH>Kebutuhan / Keperluan</TH>
                  <TH align="right">Nominal</TH>
                  <TH>Persetujuan</TH>
                  <TH>Pengambilan</TH>
                  <TH align="right">Aksi</TH>
                </tr>
              </THead>
              <TBody>
                {filtered.map((p) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(p.tanggal_pengajuan)}
                    </TD>
                    <TD className="min-w-[9rem] whitespace-nowrap">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                        {p.nama_divisi}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {p.nama_pengaju}
                      </span>
                    </TD>
                    <TD className="min-w-[12rem]">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                        {p.nama_kebutuhan ?? "-"}
                      </span>
                      <span className="safe-text mt-0.5 block text-xs text-slate-400">
                        {p.keperluan}
                      </span>
                    </TD>
                    <TD align="right" className="whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {formatRupiah(p.nominal)}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge color={STATUS_PERSETUJUAN_COLOR[p.status_persetujuan]}>
                        {STATUS_PERSETUJUAN_LABEL[p.status_persetujuan]}
                      </Badge>
                      {p.approved_at && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {formatDate(p.approved_at.slice(0, 10))}
                        </span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge color={STATUS_PENGAMBILAN_COLOR[p.status_pengambilan]}>
                        {STATUS_PENGAMBILAN_LABEL[p.status_pengambilan]}
                      </Badge>
                      {p.taken_at && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {formatDate(p.taken_at.slice(0, 10))}
                        </span>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {p.status_persetujuan === "belum" && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => {
                                setKonfirmasi({ target: p, aksi: "setujui" });
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400"
                            >
                              <Check className="h-3 w-3" />
                              Setujui
                            </button>
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => {
                                setKonfirmasi({ target: p, aksi: "hapus" });
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              Hapus
                            </button>
                          </>
                        )}

                        {p.status_persetujuan === "disetujui" &&
                          p.status_pengambilan === "belum" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() => {
                                  setKonfirmasi({ target: p, aksi: "diambil" });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 dark:bg-sky-900/20 dark:text-sky-400"
                              >
                                <Wallet className="h-3 w-3" />
                                Sudah Diambil
                              </button>
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() => {
                                  setKonfirmasi({ target: p, aksi: "tolak" });
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                              >
                                <X className="h-3 w-3" />
                                Cabut
                              </button>
                            </>
                          )}

                        {p.status_persetujuan === "disetujui" &&
                          p.status_pengambilan === "sudah_diambil" && (
                            <span className="text-[11px] text-slate-400">
                              Pengajuan selesai
                            </span>
                          )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(konfirmasi)}
        onClose={() => {
          setKonfirmasi(null);
        }}
        title={judulKonfirmasi}
      >
        {konfirmasi && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {konfirmasi.target.nama_kebutuhan ?? konfirmasi.target.keperluan}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {konfirmasi.target.nama_divisi} &middot;{" "}
                {konfirmasi.target.nama_pengaju} &middot;{" "}
                {formatRupiah(konfirmasi.target.nominal)}
              </p>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {konfirmasi.aksi === "setujui" &&
                "Setelah disetujui, divisi dapat mengajukan pencairan dan status pengambilan akan tercatat di sistem."}
              {konfirmasi.aksi === "tolak" &&
                "Persetujuan dicabut, status pengambilan dikembalikan ke \"Belum Diambil\"."}
              {konfirmasi.aksi === "diambil" &&
                "Konfirmasi bahwa uang sudah diserahkan ke pengaju. Status kebutuhan terkait akan menjadi \"Sudah Dipenuhi\"."}
              {konfirmasi.aksi === "hapus" &&
                "Pengajuan yang belum disetujui akan dihapus permanen dan kebutuhan bisa diajukan ulang."}
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setKonfirmasi(null);
                }}
              >
                Batal
              </Button>
              <Button
                onClick={jalankanAksi}
                loading={busyId === konfirmasi.target.id}
                variant={konfirmasi.aksi === "hapus" ? "danger" : "primary"}
              >
                Ya, Lanjutkan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
