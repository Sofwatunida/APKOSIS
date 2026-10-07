"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { KebutuhanStatus, Profile } from "@/lib/types";
import {
  fetchKebutuhanDetail,
  STATUS_KEBUTUHAN,
  STATUS_KEBUTUHAN_LABEL,
  type KebutuhanDetail,
} from "@/lib/kebutuhan";
import { formatDate, todayISO } from "@/lib/date";
import { buildDivisiOptions } from "@/lib/divisi-options";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { KebutuhanStatusBadge } from "@/components/kebutuhan-status-badge";
import { ExportMenu } from "@/components/export-menu";
import { validatePengajuanDana } from "@/lib/validation";
import {
  Search,
  ShoppingBag,
  HandCoins,
  Check,
  X,
  PackageCheck,
  FileText,
} from "lucide-react";

interface PengajuanForm {
  open: boolean;
  target: KebutuhanDetail | null;
  tanggal_pengajuan: string;
  nominal: string;
  keperluan: string;
}

const emptyPengajuan: PengajuanForm = {
  open: false,
  target: null,
  tanggal_pengajuan: todayISO(),
  nominal: "",
  keperluan: "",
};

export function KebutuhanDivisiBendaharaClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<KebutuhanDetail[]>([]);
  const [sudahDiajukan, setSudahDiajukan] = useState<Set<string>>(new Set());
  const [divisiOptions, setDivisiOptions] = useState<{ id: string; nama_divisi: string }[]>([]);

  const [search, setSearch] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusModal, setStatusModal] = useState<KebutuhanDetail | null>(null);
  const [catatan, setCatatan] = useState("");

  const [pengajuan, setPengajuan] = useState<PengajuanForm>(emptyPengajuan);
  const [pengajuanErrors, setPengajuanErrors] = useState<Record<string, string>>({});
  const [savingPengajuan, setSavingPengajuan] = useState(false);

  async function load() {
    try {
      const rows = await fetchKebutuhanDetail(supabase);
      setItems(rows);

      const { data: divisi } = await supabase
        .from("divisi")
        .select("id, nomor_divisi, nama_divisi")
        .order("nomor_divisi", { ascending: true });
      // Dropdown selalu lengkap: "Semua Divisi" + Divisi 01 .. Divisi 20.
      setDivisiOptions(
        buildDivisiOptions(divisi).map((d) => ({ id: d.id, nama_divisi: d.nama }))
      );

      // Kebutuhan yang sudah punya pengajuan dana (untuk mematikan tombol
      // "Ajukan Dana" dan mencegah pengajuan ganda).
      const { data: pengajuans } = await supabase
        .from("pengajuan_dana")
        .select("kebutuhan_id");
      setSudahDiajukan(
        new Set(
          (pengajuans ?? [])
            .map((p) => p.kebutuhan_id)
            .filter((v): v is string => Boolean(v))
        )
      );
    } catch {
      error("Gagal memuat data kebutuhan divisi.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((k) => {
      if (filterDivisi && k.divisi_id !== filterDivisi) return false;
      if (filterStatus && k.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          k.nama_kebutuhan,
          k.keterangan ?? "",
          k.nama_divisi,
          k.pelapor,
          k.kegiatan_laporan ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterDivisi, filterStatus]);

  const rekap = useMemo(() => {
    const c: Record<KebutuhanStatus, number> = {
      belum: 0,
      disetujui: 0,
      ditolak: 0,
      sudah_dipenuhi: 0,
    };
    items.forEach((k) => (c[k.status] += 1));
    return c;
  }, [items]);

  async function updateStatus(
    target: KebutuhanDetail,
    status: KebutuhanStatus,
    catatanBendahara?: string
  ) {
    setBusyId(target.id);
    const { error: upErr } = await supabase
      .from("kebutuhan")
      .update({
        status,
        keterangan:
          catatanBendahara && catatanBendahara.trim()
            ? [target.keterangan, `Catatan Bendahara: ${catatanBendahara.trim()}`]
                .filter(Boolean)
                .join(" | ")
            : target.keterangan,
      })
      .eq("id", target.id);

    setBusyId(null);
    if (upErr) {
      error("Gagal mengubah status kebutuhan: " + upErr.message);
      return;
    }
    success(`Status "${target.nama_kebutuhan}" diubah ke ${STATUS_KEBUTUHAN_LABEL[status]}.`);
    setStatusModal(null);
    setCatatan("");
    await load();
  }

  function openStatusModal(k: KebutuhanDetail) {
    setStatusModal(k);
    setCatatan("");
  }

  function openPengajuan(k: KebutuhanDetail) {
    setPengajuanErrors({});
    setPengajuan({
      open: true,
      target: k,
      tanggal_pengajuan: todayISO(),
      nominal: "",
      keperluan: k.nama_kebutuhan,
    });
  }

  async function submitPengajuan() {
    const target = pengajuan.target;
    if (!target) return;

    const errors = validatePengajuanDana({
      divisi_id: target.divisi_id,
      tanggal_pengajuan: pengajuan.tanggal_pengajuan,
      nominal: pengajuan.nominal === "" ? null : parseFloat(pengajuan.nominal),
      keperluan: pengajuan.keperluan,
    });
    setPengajuanErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPengajuan(true);
    const { error: insErr } = await supabase.from("pengajuan_dana").insert({
      divisi_id: target.divisi_id,
      user_id: profile.id,
      kebutuhan_id: target.id,
      tanggal_pengajuan: pengajuan.tanggal_pengajuan,
      nominal: parseFloat(pengajuan.nominal),
      keperluan: pengajuan.keperluan.trim(),
    });

    setSavingPengajuan(false);
    if (insErr) {
      // 23505 = unique (kebutuhan_id) bentrok -> pengajuan ganda.
      error(
        insErr.code === "23505"
          ? "Kebutuhan ini sudah memiliki pengajuan dana."
          : "Gagal membuat pengajuan dana: " + insErr.message
      );
      return;
    }
    success("Pengajuan dana dibuat. Menunggu persetujuan.");
    setPengajuan(emptyPengajuan);
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Kebutuhan Divisi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Semua kebutuhan yang diajukan divisi beserta status persyaratannya
          </p>
        </div>
        <ExportMenu
          title="Kebutuhan Divisi"
          subtitle="Rekap kebutuhan seluruh divisi"
          filename="kebutuhan-divisi-bendahara"
          disabled={filtered.length === 0}
          columns={[
            { header: "Tanggal", key: "tanggal", width: 13 },
            { header: "Divisi", key: "divisi", width: 18 },
            { header: "Kebutuhan", key: "kebutuhan", width: 26 },
            { header: "Jumlah", key: "jumlah", width: 9 },
            { header: "Status", key: "status", width: 15 },
            { header: "Pelapor", key: "pelapor", width: 19 },
          ]}
          rows={filtered.map((k) => ({
            tanggal: formatDate(k.tanggal_efektif),
            divisi: k.nama_divisi,
            kebutuhan: k.nama_kebutuhan,
            jumlah: k.jumlah ?? "-",
            status: STATUS_KEBUTUHAN_LABEL[k.status],
            pelapor: k.pelapor,
          }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATUS_KEBUTUHAN.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`rounded-2xl border p-4 text-left transition ${
              filterStatus === s
                ? "border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-900/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
            }`}
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {STATUS_KEBUTUHAN_LABEL[s]}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {rekap[s]}
            </p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Daftar Kebutuhan"
          subtitle={`${filtered.length} dari ${items.length} kebutuhan`}
          icon={<ShoppingBag className="h-5 w-5" />}
          action={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <Input
                  placeholder="Cari kebutuhan/divisi/pelapor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>
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
                {STATUS_KEBUTUHAN.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_KEBUTUHAN_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              title="Belum ada kebutuhan"
              description="Kebutuhan yang dikirim divisi lewat Laporan Harian akan muncul di sini."
            />
          ) : (
            <TableWrap minWidth={1100}>
              <THead>
                <tr>
                  <TH>Tanggal</TH>
                  <TH>Divisi</TH>
                  <TH>Kebutuhan</TH>
                  <TH align="right">Jumlah</TH>
                  <TH>Status</TH>
                  <TH>Pelapor</TH>
                  <TH align="right">Aksi</TH>
                </tr>
              </THead>
              <TBody>
                {filtered.map((k) => {
                  const adaPengajuan = sudahDiajukan.has(k.id);
                  return (
                    <TR key={k.id}>
                      <TD className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(k.tanggal_efektif)}
                      </TD>
                      <TD className="min-w-[9rem] whitespace-nowrap text-xs font-semibold text-slate-900 dark:text-white">
                        {k.nama_divisi}
                      </TD>
                      <TD className="min-w-[12rem]">
                        <span className="safe-text block text-sm font-medium text-slate-800 dark:text-slate-200">
                          {k.nama_kebutuhan}
                        </span>
                        {k.keterangan && (
                          <span className="safe-text mt-0.5 block text-xs text-slate-400">
                            {k.keterangan}
                          </span>
                        )}
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {k.jumlah ?? "-"}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <KebutuhanStatusBadge status={k.status} />
                        {adaPengajuan && (
                          <span className="mt-1 block text-[11px] text-emerald-600 dark:text-emerald-400">
                            Ada pengajuan dana
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {k.pelapor}
                        {k.laporan_id && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <FileText className="h-3 w-3" /> dari laporan harian
                          </span>
                        )}
                      </TD>
                      <TD align="right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {k.status === "belum" && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === k.id}
                                onClick={() => updateStatus(k, "disetujui")}
                                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400"
                              >
                                <Check className="h-3 w-3" />
                                Setujui
                              </button>
                              <button
                                type="button"
                                disabled={busyId === k.id}
                                onClick={() => updateStatus(k, "ditolak")}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400"
                              >
                                <X className="h-3 w-3" />
                                Tolak
                              </button>
                            </>
                          )}

                          {k.status === "disetujui" && (
                            <>
                              <button
                                type="button"
                                onClick={() => openStatusModal(k)}
                                className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400"
                              >
                                <PackageCheck className="h-3 w-3" />
                                Tandai Terpenuhi
                              </button>
                              <button
                                type="button"
                                disabled={adaPengajuan}
                                onClick={() => openPengajuan(k)}
                                title={
                                  adaPengajuan
                                    ? "Kebutuhan ini sudah punya pengajuan dana"
                                    : "Buat pengajuan dana untuk kebutuhan ini"
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400"
                              >
                                <HandCoins className="h-3 w-3" />
                                Ajukan Dana
                              </button>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      {/* Modal ubah status menjadi "Sudah Dipenuhi" */}
      <Modal
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        title="Tandai Kebutuhan Terpenuhi"
      >
        {statusModal && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {statusModal.nama_kebutuhan}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {statusModal.nama_divisi} &middot; {formatDate(statusModal.tanggal_efektif)}
              </p>
            </div>
            <Field label="Catatan Bendahara (Opsional)">
              <Textarea
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="mis. Sudah dibeli 2 unit pada 12 Januari..."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusModal(null)}>
                Batal
              </Button>
              <Button
                onClick={() => updateStatus(statusModal, "sudah_dipenuhi", catatan)}
                loading={busyId === statusModal.id}
              >
                Tandai Sudah Dipenuhi
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Ajukan Dana (Bendahara juga boleh mengajukan, mis. dana pusat) */}
      <Modal
        open={pengajuan.open}
        onClose={() => setPengajuan(emptyPengajuan)}
        title="Ajukan Dana"
      >
        {pengajuan.target && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-900/60">
              <p className="font-semibold text-slate-900 dark:text-white">
                {pengajuan.target.nama_kebutuhan}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {pengajuan.target.nama_divisi} &middot; Pengaju:{" "}
                {pengajuan.target.pelapor}
              </p>
            </div>
            <Field label="Tanggal Pengajuan" error={pengajuanErrors.tanggal_pengajuan}>
              <Input
                type="date"
                value={pengajuan.tanggal_pengajuan}
                onChange={(e) =>
                  setPengajuan({ ...pengajuan, tanggal_pengajuan: e.target.value })
                }
              />
            </Field>
            <Field label="Nominal (Rp)" error={pengajuanErrors.nominal}>
              <Input
                type="number"
                min="0"
                value={pengajuan.nominal}
                onChange={(e) => setPengajuan({ ...pengajuan, nominal: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Keperluan" error={pengajuanErrors.keperluan}>
              <Textarea
                rows={3}
                value={pengajuan.keperluan}
                onChange={(e) => setPengajuan({ ...pengajuan, keperluan: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPengajuan(emptyPengajuan)}>
                Batal
              </Button>
              <Button onClick={submitPengajuan} loading={savingPengajuan}>
                Buat Pengajuan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
