import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Kelola Divisi sudah digabung ke halaman "Pengelolaan Akun & Divisi".
 * Route lama dipertahankan sebagai redirect supaya tautan/bookmark lama
 * tetap sampai ke halaman yang benar.
 */
export default function SuperAdminDivisiPage() {
  redirect("/dashboard/superadmin/akun");
}
