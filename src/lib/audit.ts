import { createClient } from "./supabase/server";
import { getCurrentUser, getRealProfile, getActiveImpersonation } from "./auth";
import { ROLE_LABELS } from "./role";

export interface AuditInput {
  /** Aksi singkat, mis. "ubah_role_user", "buat_divisi", "reset_periode". */
  action: string;
  targetType?: string;
  targetId?: string;
  /** Detail tambahan (JSON string atau teks bebas). Jangan simpan password. */
  detail?: string;
  success?: boolean;
  ip?: string | null;
  device?: string | null;
}

/**
 * Menulis satu baris ke `audit_logs` (append-only).
 *
 * - Aktor diambil dari sesi berjalan (auth.uid()), bukan dari client,
 *   sehingga tidak bisa dipalsukan.
 * - RLS insert policy menolak bila actor_id ≠ auth.uid().
 * - Selama Mode Penyamaran, `actor_role` tetap role ASLI (super_admin)
 *   dan detail ditambahi sufiks "bertindak sebagai X" — sesuai
 *   kebijakan: setiap aktivitas tercatat sebagai "Dilakukan oleh
 *   Super Admin, Bertindak sebagai <role>".
 * - Kegagalan logging TIDAK BOLEH menggagalkan aksi utama, jadi error
 *   ditelan dan hanya dicatat ke console server.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const real = await getRealProfile();
    const imp = await getActiveImpersonation();
    const supabase = await createClient();

    const suffix = imp
      ? ` | bertindak sebagai ${ROLE_LABELS[imp.role] ?? imp.role}`
      : "";
    const detail = input.detail ? `${input.detail}${suffix}` : suffix || null;

    const { error } = await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      actor_role: real?.role ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      detail,
      success: input.success ?? true,
      ip: input.ip ?? null,
      device: input.device ?? null,
    });

    if (error) {
      console.error("[audit] gagal menulis log:", error.code, error.message);
    }
  } catch (e) {
    console.error("[audit] exception:", e);
  }
}
