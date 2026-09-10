interface HasJabatan {
  jabatan: string | null;
}

function jabatanSortKey(jabatan: string | null): [number, number, string] {
  const j = (jabatan ?? "").trim().toLowerCase();
  if (!j) return [5, 0, ""];
  if (j === "ketua") return [0, 0, ""];
  if (j === "wakil ketua") return [1, 0, ""];
  if (j.startsWith("anggota")) {
    const num = j.match(/(\d+)/);
    return [3, num ? parseInt(num[1], 10) : Number.MAX_SAFE_INTEGER, jabatan ?? ""];
  }
  return [2, 0, jabatan ?? ""];
}

export function sortByJabatan<T extends HasJabatan>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const [ra, na, sa] = jabatanSortKey(a.jabatan);
    const [rb, nb, sb] = jabatanSortKey(b.jabatan);
    if (ra !== rb) return ra - rb;
    if (na !== nb) return na - nb;
    return sa.localeCompare(sb);
  });
}