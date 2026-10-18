"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { startImpersonationAction } from "@/app/dashboard/actions/impersonation-actions";

/**
 * Formulir Mode Penyamaran (hanya dirender di dashboard Super Admin).
 *
 * Urutan role mengikuti ketentuan revisi: Admin Periode, Monitoring,
 * Bendahara, Sekretaris, Admin Divisi. Memulai penyamaran berarti
 * tampilan dashboard berpindah ke role tujuan; sesi Super Admin asli
 * tetap utuh dan bisa dipulihkan kapan saja lewat banner di atas.
 */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "Admin Periode" },
  { value: "monitoring", label: "Monitoring" },
  { value: "bendahara", label: "Bendahara" },
  { value: "sekretaris", label: "Sekretaris" },
  { value: "division_admin", label: "Admin Divisi" },
];

interface DivisiOption {
  id: string;
  label: string;
}

export function PenyamaranClient({ divisi }: { divisi: DivisiOption[] }) {
  const { error } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState("monitoring");
  const [divisiId, setDivisiId] = useState("");

  function handleStart() {
    if (role === "division_admin" && !divisiId) {
      error("Pilih dulu divisi yang ingin ditiru untuk Admin Divisi.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await startImpersonationAction({
          role,
          divisiId: role === "division_admin" ? divisiId : null,
        });
        if (!result.ok) {
          error(result.message);
          return;
        }
        // Berhasil: cookie tersimpan, pindah ke dashboard role tujuan.
        router.push("/dashboard");
        router.refresh();
      } catch {
        error("Gagal menghubungi server. Coba lagi.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Mode Penyamaran"
        subtitle="Lihat dan periksa sistem dari sudut pandang role lain tanpa mengubah akun apa pun."
        icon={<EyeOff className="h-5 w-5" />}
      />
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              Sesi Super Admin asli tidak pernah diubah.
            </p>
            <p className="mt-0.5">
              Password tidak disentuh, identitas asli tetap Super Admin, dan
              setiap aktivitas selama penyamaran tercatat di Log Aktivitas
              sebagai &ldquo;bertindak sebagai &lt;role&gt;&rdquo;. Akhiri
              kapan saja lewat tombol di banner atas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pilih role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={pending}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          {role === "division_admin" ? (
            <Field label="Divisi tujuan">
              <Select
                value={divisiId}
                onChange={(e) => setDivisiId(e.target.value)}
                disabled={pending}
              >
                <option value="">— Pilih divisi —</option>
                {divisi.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={handleStart}
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Masuk sebagai role
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
