"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ProgramKerja } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function ProgramKerjaReadOnly({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const { success } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProgramKerja[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("program_kerja")
        .select("*")
        .order("created_at", { ascending: false });
      setItems((data ?? []).filter((p) => !p.deskripsi?.startsWith("[UNGGULAN]")));
      setLoading(false);
    }
    load();
    const saved = localStorage.getItem("program-kerja-notes-global");
    if (saved) setNotes(saved);
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
        <h1 className="text-2xl font-bold text-slate-900">Program Kerja</h1>
        <p className="text-sm text-slate-500">Lihat program kerja dan catatan</p>
      </div>

      <Card>
        <CardHeader title="Daftar Program Kerja" subtitle={`Total ${items.length} program`} />
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Belum ada program kerja" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900">{p.nama_program}</h3>
                  {p.deskripsi && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.deskripsi}</p>
                  )}
                  {p.file_path && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(p)}
                        className="rounded-lg border border-brand-500 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
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

      <Card>
        <CardHeader
          title="Catatan Program Belum Terlaksana"
          subtitle="Catatan program kerja yang belum dapat dilaksanakan"
        />
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tuliskan catatan program kerja yang belum terlaksana di sini..."
            rows={5}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-y"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("program-kerja-notes-global", notes);
                success("Catatan tersimpan.");
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Simpan Catatan
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
