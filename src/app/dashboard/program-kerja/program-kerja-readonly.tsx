"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProgramKerja } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { CatatanProgramBelumTerlaksana } from "@/components/program-belum-terlaksana";

interface ProgramKerjaRow extends ProgramKerja {
  divisi?: { nama_divisi: string } | null;
}

export function ProgramKerjaReadOnly({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProgramKerjaRow[]>([]);
  const [unggulanItems, setUnggulanItems] = useState<ProgramKerjaRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("program_kerja")
        .select("*, divisi(nama_divisi)")
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Program Kerja</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Lihat program kerja dan catatan</p>
      </div>

      <Card>
        <CardHeader
          title="Program Unggulan"
          subtitle="Program unggulan tiap divisi yang dapat diunduh"
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
                      <h3 className="font-semibold text-slate-900 dark:text-white">{p.nama_program}</h3>
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                        Unggulan
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {p.divisi?.nama_divisi ?? "Divisi tidak diketahui"}
                    </p>
                    {cleanDesc && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{cleanDesc}</p>
                    )}
                    {p.file_name && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <span>📎</span>
                        <span className="truncate max-w-[220px]">{p.file_name}</span>
                      </p>
                    )}
                    {p.file_path && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(p)}
                          className="rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:bg-slate-900 dark:text-brand-400"
                        >
                          Download File
                        </button>
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
        <CardHeader title="Daftar Program Kerja" subtitle={`Total ${items.length} program`} />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada program kerja" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{p.nama_program}</h3>
                  {p.deskripsi && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{p.deskripsi}</p>
                  )}
                  {p.file_path && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(p)}
                        className="rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:bg-slate-900 dark:text-brand-400"
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

      {profile.role !== "bendahara" && <CatatanProgramBelumTerlaksana profile={profile} />}
    </div>
  );
}
