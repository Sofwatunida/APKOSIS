"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_PERIODS_VALUE,
  PERIOD_STATUS_LABELS,
} from "./period-constants";
import {
  readPeriodCookie,
  setClientPeriodScope,
  writePeriodCookie,
} from "./period-scope";

export interface PeriodeClientOption {
  id: string;
  namaPeriode: string;
  tahunMulai: number;
  tahunSelesai: number;
  status: "active" | "archived" | "inactive";
}

interface PeriodeContextValue {
  periodeId: string | null;
  allPeriodsMode: boolean;
  options: PeriodeClientOption[];
  readOnly: boolean;
  canChangePeriod: boolean;
  changePeriode: (value: string) => void;
}

const PeriodeContext = createContext<PeriodeContextValue>({
  periodeId: null,
  allPeriodsMode: false,
  options: [],
  readOnly: false,
  canChangePeriod: true,
  changePeriode: () => {},
});

export function usePeriode(): PeriodeContextValue {
  return useContext(PeriodeContext);
}

/**
 * Memberi tahu seluruh client component periode mana yang aktif
 * sekaligus memasang scope query. Tidak ada halaman yang boleh
 * meng-hardcode daftar tahun.
 */
export function PeriodeProvider({
  periodeId,
  allPeriodsMode,
  options,
  readOnly,
  canChangePeriod,
  children,
}: {
  periodeId: string | null;
  allPeriodsMode: boolean;
  options: PeriodeClientOption[];
  readOnly: boolean;
  canChangePeriod: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const value = useMemo<PeriodeContextValue>(
    () => ({
      periodeId,
      allPeriodsMode,
      options,
      readOnly,
      canChangePeriod,
      changePeriode: () => {},
    }),
    [periodeId, allPeriodsMode, options, readOnly, canChangePeriod]
  );

  useEffect(() => {
    // Admin tidak pernah boleh mengambil scope dari cookie.
    setClientPeriodScope(
      periodeId ?? (canChangePeriod ? readPeriodCookie() : null)
    );
  }, [periodeId, canChangePeriod]);

  const changePeriode = useCallback(
    (next: string) => {
      if (!canChangePeriod) return;
      writePeriodCookie(next);
      setClientPeriodScope(next);
      router.refresh();
    },
    [router, canChangePeriod]
  );

  const ctx = useMemo(
    () => ({ ...value, changePeriode }),
    [value, changePeriode]
  );

  return (
    <PeriodeContext.Provider value={ctx}>{children}</PeriodeContext.Provider>
  );
}

export { ALL_PERIODS_VALUE, PERIOD_STATUS_LABELS };