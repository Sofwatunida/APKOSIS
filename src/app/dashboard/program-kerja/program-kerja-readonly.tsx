"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProgramKerja } from "@/lib/types";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { CatatanProgramBelumTerlaksana } from "@/components/program-belum-terlaksana";
import { RichTextContent } from "@/components/ui/rich-text-editor";
import { Modal } from "@/components/ui/modal";
import { formatDivisiLabel } from "@/lib/divisi-options";

interface ProgramKerjaRow extends ProgramKerja {
  divisi?: { nomor_divisi: number | null; nama_divisi: string } | null;
}

export function ProgramKerjaReadOnly({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProgramKerjaRow[]>([]);
  const [unggulanItems, setUnggulanItems] = useState<ProgramKerjaRow[]>([]);
  const [viewUnggulan, setViewUnggulan] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("program_kerja")
        .select("*, divisi(nomor_divisi, nama_divisi)")
        .order("created_at", { ascending: false });
      const all = (data ?? []) as ProgramKerjaRow[];
      setUnggulanItems(all.filter((p) => p.deskripsi?.startsWith("[UNGGULAN]") ?? false));
      setItems(all.filter((p) => !(p.deskripsi?.startsWith("[UNGGULAN]") ?? false)));
      setLoading(false);
    }
    load();
  }, []);

  async function handleDownloadFile(item: ProgramKerja) {
    if (!item.file_path) return;
    try {
      const { data, error: downErr } = await supabase.storage.from("program-kerja").download(item.file_path);
      if (!downErr && data) {
        const blobUrl = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = item.file_name || "program-kerja";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // silent
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Kerja"
      />

      <Card>
        <CardHeader
          title="Program Unggulan"
        />
        <CardContent>
          {unggulanItems.length === 0 ? (
            <EmptyState title="Belum ada program unggulan" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {unggulanItems.map((p) => {
                const cleanDesc = p.deskripsi?.replace(/^\[UNGGULAN\]\s*/, "") ?? "";
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">{p.nama_program}</h3>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                        Unggulan
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {p.divisi
                        ? formatDivisiLabel(p.divisi.nomor_divisi, p.divisi.nama_divisi)
                        : "Divisi tidak diketahui"}
                    </p>
                    {cleanDesc && (
                      <div className="mt-1 line-clamp-4 text-sm text-slate-500 dark:text-slate-400">
                        <RichTextContent html={cleanDesc} />
                      </div>
                    )}
                    {p.file_name && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <span>📎</span>
                        <span className="min-w-0 max-w-full truncate">{p.file_name}</span>
                      </p>
                    )}
                    {(cleanDesc || p.file_path) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        {cleanDesc && (
                          <button
                            type="button"
                            onClick={() => setViewUnggulan({ title: p.nama_program ?? "Program Unggulan", desc: cleanDesc })}
                            className="tap-target rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Lihat
                          </button>
                        )}
                        {p.file_path && (
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(p)}
                            className="tap-target rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:bg-slate-900 dark:text-brand-400"
                          >
                            Download File
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Daftar Program Kerja" />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada program kerja" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">{p.nama_program}</h3>
                  {p.deskripsi && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{p.deskripsi}</p>
                  )}
                  {p.file_path && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(p)}
                        className="tap-target rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:bg-slate-900 dark:text-brand-400"
                      >
                        Download File
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!viewUnggulan}
        onClose={() => setViewUnggulan(null)}
        title={viewUnggulan?.title ?? "Program Unggulan"}
      >
        <RichTextContent html={viewUnggulan?.desc ?? ""} className="text-sm text-slate-700 dark:text-slate-200" />
      </Modal>

      <CatatanProgramBelumTerlaksana profile={profile} />
    </div>
  );
}
