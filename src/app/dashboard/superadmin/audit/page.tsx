import { requireProfile, requireSuperAdmin } from "@/lib/guard";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, PageHeader } from "@/components/ui/card";
import { History, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuditClient } from "./audit-client";

export const dynamic = "force-dynamic";

export interface AuditRow {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  success: boolean;
  createdAt: string;
}

const FETCH_LIMIT = 1000;

export default async function SuperAdminAuditPage() {
  const { profile } = await requireProfile();
  requireSuperAdmin(profile);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_email, actor_role, action, target_type, target_id, detail, success, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  const rows: AuditRow[] = (data ?? []).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    detail: r.detail,
    success: r.success,
    createdAt: r.created_at,
  }));

  return (
    <AppShell profile={profile}>
      <div className="space-y-6">
        <PageHeader
          title="Log Aktivitas"
          description="Riwayat hanya-baca (append-only) tindakan penting di sistem."
        />

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-900/20"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
              <ShieldCheck className="h-4 w-4" />
              Gagal membaca log: {error.code} — {error.message}
            </p>
          </div>
        )}

        <Card>
          <CardHeader
            title={`Riwayat (${rows.length})`}
            subtitle="Mencatat aktor, aksi, target, waktu, dan status sukses/gagal. Tidak bisa diubah atau dihapus."
            icon={<History className="h-5 w-5" />}
          />
          <CardContent>
            <AuditClient rows={rows} limit={FETCH_LIMIT} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
