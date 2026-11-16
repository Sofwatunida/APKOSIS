"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export const DEFAULT_PAGE_SIZE = 5;

export function usePagination(totalItems: number, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const start =
    totalItems === 0 ? 0 : showAll ? 1 : (safePage - 1) * pageSize + 1;
  const end =
    totalItems === 0
      ? 0
      : showAll
        ? totalItems
        : Math.min(safePage * pageSize, totalItems);

  const goTo = useCallback(
    (next: number) => {
      setPage((current) => {
        const max = Math.max(1, Math.ceil(totalItems / pageSize));
        return Math.min(Math.max(1, next), max) || current;
      });
    },
    [totalItems, pageSize]
  );

  const toggleShowAll = useCallback(() => {
    setShowAll((current) => {
      if (!current) setPage(1);
      return !current;
    });
  }, []);

  const reset = useCallback(() => setPage(1), []);

  return {
    page: safePage,
    pageCount,
    pageSize,
    showAll,
    start,
    end,
    goTo,
    toggleShowAll,
    reset,
    setPage,
  };
}

export function TablePagination({
  total,
  page,
  pageCount,
  showAll,
  start,
  end,
  label = "data",
  onPageChange,
  onToggleAll,
  className = "",
}: {
  total: number;
  page: number;
  pageCount: number;
  showAll: boolean;
  start: number;
  end: number;
  label?: string;
  onPageChange: (page: number) => void;
  onToggleAll: () => void;
  className?: string;
}) {
  if (total === 0) return null;

  const canExpand = total > DEFAULT_PAGE_SIZE;

  return (
    <div
      className={`flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-xs text-muted-foreground">
        Menampilkan {start}&ndash;{end} dari {total} {label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showAll ? (
          <Button type="button" variant="outline" size="sm" onClick={onToggleAll}>
            Tampilkan Lebih Sedikit
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Sebelumnya</span>
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Hal {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {canExpand && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleAll}
              >
                Lihat Semua
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
