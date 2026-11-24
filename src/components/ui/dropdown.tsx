"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ElementRef = { current: HTMLElement | null };
type Align = "start" | "center" | "end";

interface PositionOptions {
  open: boolean;
  anchorRef: ElementRef;
  panelRef: ElementRef;
  align?: Align;
  offset?: number;
  minWidth?: number;
}

export function useDropdownPosition({
  open,
  anchorRef,
  panelRef,
  align = "start",
  offset = 8,
  minWidth = 0,
}: PositionOptions): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
    zIndex: 80,
  });

  const update = useCallback(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth || Math.max(rect.width, minWidth);
    const panelHeight = panel.offsetHeight;
    const spaceBelow = viewportHeight - rect.bottom - offset;
    const spaceAbove = rect.top - offset;
    const placeBelow = spaceBelow >= panelHeight || spaceBelow >= spaceAbove;

    const preferredTop = placeBelow
      ? rect.bottom + offset
      : rect.top - panelHeight - offset;
    const top = Math.max(
      8,
      Math.min(preferredTop, Math.max(8, viewportHeight - panelHeight - 8)),
    );

    const preferredLeft =
      align === "end"
        ? rect.right - panelWidth
        : align === "center"
          ? rect.left + rect.width / 2 - panelWidth / 2
          : rect.left;
    const left = Math.max(
      8,
      Math.min(preferredLeft, Math.max(8, viewportWidth - panelWidth - 8)),
    );

    setStyle({
      position: "fixed",
      top,
      left,
      minWidth: Math.min(rect.width, viewportWidth - 16),
      maxWidth: viewportWidth - 16,
      visibility: "visible",
      zIndex: 80,
    });
  }, [open, anchorRef, panelRef, align, offset, minWidth]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}

interface DismissOptions {
  open: boolean;
  anchorRef: ElementRef;
  panelRef: ElementRef;
  onClose: () => void;
  onEscape?: () => void;
}

export function useDropdownDismiss({
  open,
  anchorRef,
  panelRef,
  onClose,
  onEscape,
}: DismissOptions) {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      (onEscape ?? onClose)();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, anchorRef, panelRef, onClose, onEscape]);
}

interface DropdownPanelProps {
  open: boolean;
  anchorRef: ElementRef;
  onClose: () => void;
  onEscape?: () => void;
  align?: Align;
  offset?: number;
  minWidth?: number;
  className?: string;
  children: ReactNode;
  role?: string;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export function DropdownPanel({
  open,
  anchorRef,
  onClose,
  onEscape,
  align = "start",
  offset = 8,
  minWidth,
  className = "",
  children,
  role,
  id,
  ariaLabel,
  ariaLabelledBy,
}: DropdownPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const style = useDropdownPosition({
    open,
    anchorRef,
    panelRef,
    align,
    offset,
    minWidth,
  });

  useDropdownDismiss({ open, anchorRef, panelRef, onClose, onEscape });

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={style}
      className={`dropdown-panel ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
