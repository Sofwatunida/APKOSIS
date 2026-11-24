"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function PeriodeSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" loading={pending} disabled={pending}>
      {pending ? "Membuat Periode..." : "Buat Periode"}
    </Button>
  );
}
