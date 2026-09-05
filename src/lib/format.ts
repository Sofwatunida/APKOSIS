export function formatRupiah(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatRupiahPlain(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "Rp 0";
  return "Rp " + new Intl.NumberFormat("id-ID").format(num);
}
