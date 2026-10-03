"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface PeriodActionResult {
  ok: boolean;
  message: string;
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

  if (error) return fail(error.message);
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

  if (error) return fail(error.message);
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

  if (error) return fail(error.message);
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

  if (error) return fail(error.message);
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

  if (error) return fail(error.message);
  revalidatePath("/dashboard/superadmin/akun");
  return ok("Role user diperbarui.");
}

/** Reset password divisi (dipakai Super Admin dan Admin Periode). */
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

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_division_password", {
    p_divisi_id: divisiId,
    p_password: password,
    p_periode_id: periodeId,
  });

  if (error) return fail(error.message);
  revalidatePath("/dashboard/password-divisi");
  revalidatePath("/dashboard/admin/password-divisi");
  revalidatePath("/dashboard/superadmin/akun");
  return ok("Password divisi diperbarui.");
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

  if (error) return fail(error.message);
  revalidatePath("/dashboard/superadmin/divisi");
  revalidatePath("/dashboard/admin/divisi");
  return ok("Periode divisi diperbarui.");
}

/** Guard dipakai halaman agar tidak bisa dibuka role lain. */
export async function assertSuperAdminPage(): Promise<PeriodActionResult | null> {
  const profile = await getProfile();
  if (!profile || profile.role !== "super_admin") {
    return fail("Hanya Super Admin.");
  }
  return null;
}