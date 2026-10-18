"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import type { Json } from "@/lib/database.types";

export interface PeriodActionResult {
  ok: boolean;
  message: string;
  /** Waktu simpan terakhir (dari database), hanya untuk aksi akun divisi. */
  updatedAt?: string;
  /** Periode divisi setelah disimpan (dari database). */
  periodeId?: string;
}

/**
 * Adapter untuk `<form action={...}>` yang wajib return `void`.
 *
 * Pesan hasil dikirim lewat query string supaya server component
 * bisa menampilkannya tanpa harus melakukan fetch balik dari client.
 */
export async function createPeriodeFormAction(formData: FormData): Promise<void> {
  const result = await createPeriodeAction(formData);
  const params = new URLSearchParams({
    ok: result.ok ? "1" : "0",
    pesan: result.message,
  });
  redirect(`/dashboard/superadmin/periode?${params.toString()}`);
}

function ok(message: string): PeriodActionResult {
  return { ok: true, message };
}

function fail(message: string): PeriodActionResult {
  return { ok: false, message };
}

/**
 * PostgREST kadang mengembalikan pesan error sebagai string JSON utuh.
 * Ambil bagian `message`-nya supaya toast tidak menampilkan mentah.
 */
function pesanDb(message: string): string {
  const teks = message.trim();
  if (!teks.startsWith("{")) return teks;
  try {
    const parsed = JSON.parse(teks) as { message?: string };
    return parsed.message?.trim() || teks;
  } catch {
    return teks;
  }
}

/**
 * Semua aksi periode TIDAK boleh jalan kalau pemanggil bukan
 * Super Admin. Penjaga kedua ada di RLS + fungsi database
 * (lihat migration 20261001000002), jadifano client-side saja
 * tidak cukup dan memang tidak diandalkan.
 */
async function requireSuperAdmin(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>> } | { error: PeriodActionResult }
> {
  const profile = await getProfile();
  if (!profile || profile.role !== "super_admin") {
    return {
      error: fail("Hanya Super Admin yang boleh melakukan tindakan ini."),
    };
  }
  return { supabase: await createClient() };
}

export async function createPeriodeAction(formData: FormData): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const namaPeriode = String(formData.get("nama_periode") ?? "").trim();
  const tahunMulai = Number(formData.get("tahun_mulai"));
  const tahunSelesai = Number(formData.get("tahun_selesai"));

  if (!/^\d{4}\/\d{4}$/.test(namaPeriode)) {
    return fail("Format periode harus 2026/2027.");
  }
  if (!Number.isInteger(tahunMulai) || !Number.isInteger(tahunSelesai)) {
    return fail("Tahun mulai dan tahun selesai harus berupa angka.");
  }
  if (tahunSelesai !== tahunMulai + 1) {
    return fail("Tahun selesai harus satu tahun setelah tahun mulai.");
  }

  const { error } = await auth.supabase.rpc("admin_period_create", {
    p_nama_periode: namaPeriode,
    p_tahun_mulai: tahunMulai,
    p_tahun_selesai: tahunSelesai,
  });

  if (error) {
    await writeAuditLog({
      action: "buat_periode",
      targetType: "periode",
      detail: namaPeriode,
      success: false,
    });
    return fail(error.message);
  }
  await writeAuditLog({
    action: "buat_periode",
    targetType: "periode",
    detail: namaPeriode,
    success: true,
  });
  revalidatePath("/dashboard/superadmin/periode");
  return ok(`Periode ${namaPeriode} dibuat.`);
}

export async function activatePeriodeAction(
  _prev: PeriodActionResult | null,
  formData: FormData
): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const periodeId = String(formData.get("periode_id") ?? "");
  if (!periodeId) return fail("Periode tidak valid.");

  const { error } = await auth.supabase.rpc("admin_period_activate", {
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "aktifkan_periode", targetType: "periode", targetId: periodeId, success: false });
    return fail(error.message);
  }
  await writeAuditLog({ action: "aktifkan_periode", targetType: "periode", targetId: periodeId, success: true });
  revalidatePath("/dashboard/superadmin/periode");
  revalidatePath("/dashboard");
  return ok("Periode aktif berhasil diganti. Periode lama diarsipkan.");
}

export async function archivePeriodeAction(formData: FormData): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const periodeId = String(formData.get("periode_id") ?? "");
  if (!periodeId) return fail("Periode tidak valid.");

  const { error } = await auth.supabase.rpc("admin_period_archive", {
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "arsipkan_periode", targetType: "periode", targetId: periodeId, success: false });
    return fail(error.message);
  }
  await writeAuditLog({ action: "arsipkan_periode", targetType: "periode", targetId: periodeId, success: true });
  revalidatePath("/dashboard/superadmin/periode");
  return ok("Periode diarsipkan. Datanya tetap bisa dibaca.");
}

export async function updatePeriodeAction(formData: FormData): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const periodeId = String(formData.get("periode_id") ?? "");
  const namaPeriode = String(formData.get("nama_periode") ?? "").trim() || null;
  const tahunMulaiRaw = String(formData.get("tahun_mulai") ?? "").trim();
  const tahunSelesaiRaw = String(formData.get("tahun_selesai") ?? "").trim();

  if (!periodeId) return fail("Periode tidak valid.");

  const { error } = await auth.supabase.rpc("admin_period_update", {
    p_periode_id: periodeId,
    p_nama_periode: namaPeriode,
    p_tahun_mulai: tahunMulaiRaw ? Number(tahunMulaiRaw) : null,
    p_tahun_selesai: tahunSelesaiRaw ? Number(tahunSelesaiRaw) : null,
  });

  if (error) return fail(error.message);
  revalidatePath("/dashboard/superadmin/periode");
  return ok("Data periode diperbarui.");
}

/** Menugaskan user sebagai Admin untuk satu periode. */
export async function assignAdminAction(formData: FormData): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const userId = String(formData.get("user_id") ?? "");
  const periodeId = String(formData.get("periode_id") ?? "") || null;
  if (!userId) return fail("Pilih user terlebih dahulu.");

  const { error } = await auth.supabase.rpc("admin_assign_period", {
    p_user_id: userId,
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "tugaskan_periode_user", targetType: "user", targetId: userId, detail: periodeId ?? "tanpa-periode", success: false });
    return fail(error.message);
  }
  await writeAuditLog({ action: "tugaskan_periode_user", targetType: "user", targetId: userId, detail: periodeId ?? "tanpa-periode", success: true });
  revalidatePath("/dashboard/superadmin/akun");
  return ok("Penugasan Admin diperbarui.");
}

/**
 * Mengubah role user.
 * Protected: user tidak boleh mengubah dirinya sendiri, dan
 * role super_admin hanya boleh diberikan oleh Super Admin lain
 * (divalidasi ulang di database).
 */
export async function setUserRoleAction(formData: FormData): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const me = await getProfile();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId || !role) return fail("Data tidak lengkap.");
  if (me && userId === me.id) {
    return fail("Anda tidak boleh mengubah role akun Anda sendiri.");
  }

  const { error } = await auth.supabase.rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    await writeAuditLog({ action: "ubah_role_user", targetType: "user", targetId: userId, detail: role, success: false });
    return fail(error.message);
  }
  await writeAuditLog({ action: "ubah_role_user", targetType: "user", targetId: userId, detail: role, success: true });
  revalidatePath("/dashboard/superadmin/akun");
  return ok("Role user diperbarui.");
}

/**
 * Simpan konfigurasi akun divisi: password + periode, sekaligus.
 *
 * Satu panggilan RPC `admin_division_account_save` yang:
 *   - menyimpan periode ke `divisi` (sumber kebenaran aplikasi),
 *   - menulis hash bcrypt ke `division_credentials`,
 *   - memverifikasi hash benar-benar tersimpan,
 *   - mencabut sesi divisi supaya password baru langsung berlaku.
 *
 * Semuanya atomik di database. Kalau gagal, tidak ada notifikasi
 * sukses palsu dan data lama tetap utuh.
 */
export async function setDivisionPasswordAction(
  formData: FormData
): Promise<PeriodActionResult> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return fail("Hanya Admin atau Super Admin yang boleh mengatur password divisi.");
  }

  const divisiId = String(formData.get("divisi_id") ?? "");
  const password = String(formData.get("password") ?? "");
  const periodeId = String(formData.get("periode_id") ?? "") || null;

  if (!divisiId) return fail("Divisi tidak valid.");
  if (password.length < 4) return fail("Password divisi minimal 4 karakter.");
  if (password.length > 128) return fail("Password divisi maksimal 128 karakter.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_division_account_save", {
    p_divisi_id: divisiId,
    p_password: password,
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "atur_password_divisi", targetType: "divisi", targetId: divisiId, success: false });
    return fail(pesanDb(error.message));
  }

  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved) return fail("Password gagal disimpan. Data lama tidak berubah.");

  await writeAuditLog({ action: "atur_password_divisi", targetType: "divisi", targetId: divisiId, success: true });

  revalidatePath("/dashboard/password-divisi");
  revalidatePath("/dashboard/admin/password-divisi");
  revalidatePath("/dashboard/admin/divisi");
  revalidatePath("/dashboard/superadmin/divisi");
  revalidatePath("/dashboard/superadmin/akun");

  return {
    ok: true,
    message: "Password divisi berhasil disimpan.",
    updatedAt: saved.updated_at ?? undefined,
    periodeId: saved.periode_id ?? undefined,
  };
}

/** Mengaitkan / melepas divisi ke suatu periode. */
export async function setDivisiPeriodAction(formData: FormData): Promise<PeriodActionResult> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "admin")) {
    return fail("Tidak punya izin.");
  }

  const divisiId = String(formData.get("divisi_id") ?? "");
  const periodeId = String(formData.get("periode_id") ?? "") || null;
  if (!divisiId) return fail("Divisi tidak valid.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_divisi_set_period", {
    p_divisi_id: divisiId,
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "atur_periode_divisi", targetType: "divisi", targetId: divisiId, detail: periodeId ?? "lepas", success: false });
    return fail(error.message);
  }
  await writeAuditLog({ action: "atur_periode_divisi", targetType: "divisi", targetId: divisiId, detail: periodeId ?? "lepas", success: true });
  revalidatePath("/dashboard/superadmin/divisi");
  revalidatePath("/dashboard/admin/divisi");
  return ok("Periode divisi diperbarui.");
}

/**
 * Menambah divisi baru (hanya Super Admin).
 * Validasi nomor & nama (tanpa duplikat) ditegakkan di database lewat
 * RPC `admin_divisi_create` (SECURITY DEFINER), bukan hanya di client.
 */
export async function createDivisiAction(
  formData: FormData
): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const nomor = Number(formData.get("nomor_divisi"));
  const nama = String(formData.get("nama_divisi") ?? "").trim();
  const periodeId = String(formData.get("periode_id") ?? "") || null;

  if (!Number.isInteger(nomor) || nomor < 1) {
    return fail("Nomor divisi harus berupa angka lebih dari 0.");
  }
  if (!nama) return fail("Nama divisi tidak boleh kosong.");
  if (nama.length > 120) return fail("Nama divisi maksimal 120 karakter.");

  const { error } = await auth.supabase.rpc("admin_divisi_create", {
    p_nomor: nomor,
    p_nama: nama,
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({ action: "buat_divisi", targetType: "divisi", detail: `${nomor} - ${nama}`, success: false });
    return fail(pesanDb(error.message));
  }
  await writeAuditLog({ action: "buat_divisi", targetType: "divisi", detail: `${nomor} - ${nama}`, success: true });
  revalidatePath("/dashboard/superadmin/divisi");
  revalidatePath("/dashboard/superadmin/akun");
  return ok(`Divisi ${nama} (nomor ${nomor}) berhasil ditambahkan.`);
}

/**
 * Reset data operasional satu periode (hanya Super Admin).
 * Menghapus laporan/keuangan/kendala/inventaris/kebutuhan/opsi kegiatan
 * untuk periode terpilih. Akun, divisi, periode, dan program kerja TIDAK
 * disentuh. Ditegakkan di database (RPC SECURITY DEFINER) + dicatat ke
 * audit log.
 */
export async function resetPeriodeDataAction(
  formData: FormData
): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const periodeId = String(formData.get("periode_id") ?? "");
  if (!periodeId) return fail("Pilih periode yang akan direset.");

  const { data, error } = await auth.supabase.rpc("admin_reset_periode_data", {
    p_periode_id: periodeId,
  });

  if (error) {
    await writeAuditLog({
      action: "reset_data_periode",
      targetType: "periode",
      targetId: periodeId,
      success: false,
    });
    return fail(error.message);
  }

  const summary = (data ?? {}) as Record<string, number>;
  const total = Object.values(summary).reduce((s, n) => s + (Number(n) || 0), 0);
  await writeAuditLog({
    action: "reset_data_periode",
    targetType: "periode",
    targetId: periodeId,
    detail: JSON.stringify(summary),
    success: true,
  });

  revalidatePath("/dashboard/superadmin/backup");
  revalidatePath("/dashboard/superadmin/laporan");
  return ok(`Reset selesai. ${total} baris data operasional periode dihapus.`);
}

/**
 * Pulihkan backup JSON (merge idempoten, hanya Super Admin).
 * Hanya menambah baris yang belum ada (ON CONFLICT DO NOTHING) dan hanya
 * untuk baris yang referensinya valid — tidak menimpa data existing.
 */
export async function restoreBackupAction(
  formData: FormData
): Promise<PeriodActionResult> {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) return fail("Tidak ada isi backup untuk dipulihkan.");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail("File backup tidak valid (bukan JSON).");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail("Struktur backup tidak valid.");
  }

  const { data, error } = await auth.supabase.rpc("admin_restore_backup", {
    p_payload: payload as Json,
  });

  if (error) {
    await writeAuditLog({
      action: "restore_backup",
      targetType: "backup",
      success: false,
    });
    return fail(error.message);
  }

  const summary = (data ?? {}) as Record<string, number>;
  const total = Object.values(summary).reduce((s, n) => s + (Number(n) || 0), 0);
  await writeAuditLog({
    action: "restore_backup",
    targetType: "backup",
    detail: JSON.stringify(summary),
    success: true,
  });

  revalidatePath("/dashboard/superadmin/backup");
  revalidatePath("/dashboard/superadmin/laporan");
  return ok(`Pemulihan selesai. ${total} baris ditambahkan (data existing tidak ditimpa).`);
}

/** Guard dipakai halaman agar tidak bisa dibuka role lain. */
export async function assertSuperAdminPage(): Promise<PeriodActionResult | null> {
  const profile = await getProfile();
  if (!profile || profile.role !== "super_admin") {
    return fail("Hanya Super Admin.");
  }
  return null;
}