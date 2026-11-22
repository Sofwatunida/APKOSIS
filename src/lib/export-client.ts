"use client";

import { buildDocxBlob } from "./docx-writer";
import {
  computeSummary,
  DOCUMENT_ARGB,
  DOCUMENT_PALETTE,
  DOCUMENT_RGB,
  footerIdentity,
  kopLines,
  reportMetaRows,
  reportNotes,
  resolveApproval,
  resolveDocumentType,
  todayLabel,
  type ExportInput,
  type ExportFormat,
  type KopLine,
  type LogoImage,
  type SummaryItem,
  type ApprovalSpec,
} from "./export-document";

export {
  type ExportColumn,
  type ApprovalSpec,
  type ExportFormat,
  type ExportInput,
  type ExportOrientation,
  type KopLine,
  type LogoImage,
  type SummaryItem,
  DOCUMENT_PALETTE,
} from "./export-document";

/* ------------------------------ shared values ------------------------------ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prepText(value: string): string {
  return value
    .replace(/[•▪◦●]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ");
}

export function cellValue(row: Record<string, unknown> | undefined, key: string): string {
  const v = row?.[key];
  if (v === null || v === undefined || v === "") return "-";
  return prepText(String(v));
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Logo sekolah hanya dipakai bila administrator mengkonfigurasi URL-nya. */
async function resolveLogo(url?: string): Promise<LogoImage | undefined> {
  if (!url?.trim() || typeof Image === "undefined" || typeof document === "undefined")
    return undefined;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const max = 160;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(undefined);
        ctx.fillStyle = DOCUMENT_PALETTE.white;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), width, height });
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = url.trim();
  });
}

interface PreparedDocument {
  input: ExportInput;
  kop: KopLine[];
  metaRows: [string, string][];
  summary: SummaryItem[];
  notes: string[];
  approval: ApprovalSpec;
  periodLabel: string;
  documentType: string;
  logo?: LogoImage;
  landscape: boolean;
}

async function prepareDocument(input: ExportInput): Promise<PreparedDocument> {
  const periodLabel =
    input.periodLabel?.trim() ||
    input.subtitle
      ?.split("·")
      .map((s) => s.trim())
      .find((s) => /^periode\b/i.test(s)) ||
    "Tanpa Periode";
  const documentType = input.documentType || resolveDocumentType(input.title);
  return {
    input,
    kop: kopLines(input.kop),
    metaRows: reportMetaRows(input, periodLabel),
    summary: computeSummary(input.columns, input.rows, input.extraSummary),
    notes: reportNotes(input),
    approval: resolveApproval(input.title, input.kop, input.approval),
    periodLabel,
    documentType,
    logo: input.logo ?? (await resolveLogo(input.kop?.logoUrl)),
    landscape:
      input.orientation === "landscape" ||
      (input.orientation !== "portrait" && input.columns.length >= 6),
  };
}

function columnRatios(input: ExportInput): number[] {
  const widths = input.columns.map((c) => c.width ?? 1);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => w / total);
}

function cellAlign(c: { align?: "left" | "right" | "center" }): "left" | "right" | "center" {
  return c.align === "right" ? "right" : c.align === "center" ? "center" : "left";
}

function columnLetter(n: number): string {
  let s = "";
  let value = n;
  while (value > 0) {
    const rem = (value - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    value = Math.floor((value - 1) / 26);
  }
  return s || "A";
}

/* ----------------------------------- excel ----------------------------------- */

async function buildExcelBlob(doc: PreparedDocument): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const { input } = doc;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Laporan OSIS", {
    properties: { defaultRowHeight: 18 },
  });
  const ratios = columnRatios(input);
  ws.columns = input.columns.map((c, i) => ({
    key: c.key,
    width: Math.min(Math.max(Math.round(ratios[i] * 54), 12), 58),
  }));
  const identityStartCol = doc.logo && input.columns.length > 1 ? 2 : 1;

  const thin = { style: "thin" as const, color: { argb: DOCUMENT_ARGB.border } };
  const bodyBorder = { top: thin, left: thin, bottom: thin, right: thin };
  const navyBorder = { style: "medium" as const, color: { argb: DOCUMENT_ARGB.navy } };

  function identityRow(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: string;
      italic?: boolean;
      height?: number;
      align?: "left" | "center" | "right";
    } = {}
  ) {
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow([]);
    row.height = opts.height ?? (opts.size && opts.size >= 12 ? 24 : 17);
    ws.mergeCells(rowIdx, identityStartCol, rowIdx, input.columns.length);
    const cellRef = row.getCell(identityStartCol);
    cellRef.value = text;
    cellRef.font = {
      size: opts.size ?? 10,
      bold: Boolean(opts.bold),
      italic: Boolean(opts.italic),
      color: { argb: opts.color ?? DOCUMENT_ARGB.text },
      name: "Aptos",
    };
    cellRef.alignment = {
      horizontal: opts.align ?? "center",
      vertical: "middle",
      wrapText: true,
    };
    return rowIdx;
  }

  if (doc.logo && input.columns.length > 1) {
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow([]);
    row.height = 72;
    const imageId = wb.addImage({
      extension: "jpeg",
      base64: doc.logo.dataUrl.replace(/^data:image\/[^;]+;base64,/, ""),
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: rowIdx - 1 },
      ext: { width: 64, height: 64 },
    });
  }

  doc.kop.forEach((line) =>
    identityRow(line.text, {
      size: line.size,
      bold: line.bold,
      color: line.color === "navy" ? DOCUMENT_ARGB.navy : DOCUMENT_ARGB.text,
    })
  );
  if (doc.kop.length) {
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow([]);
    row.height = 8;
    ws.mergeCells(rowIdx, identityStartCol, rowIdx, input.columns.length);
    row.getCell(identityStartCol).border = { bottom: navyBorder };
  }

  identityRow(doc.input.title, { size: 15, bold: true, color: DOCUMENT_ARGB.navy, height: 28 });
  identityRow(doc.documentType, { size: 9, bold: true, color: DOCUMENT_ARGB.blue, height: 18 });
  doc.metaRows.forEach(([label, value]) =>
    identityRow(`${label}: ${value}`, { size: 9, align: "left", height: 18 })
  );

  identityRow("DATA LAPORAN", {
    size: 10,
    bold: true,
    color: DOCUMENT_ARGB.navy,
    align: "left",
    height: 20,
  });

  const headerRowIndex = ws.rowCount + 1;
  const headerRow = ws.addRow(input.columns.map((c) => c.header));
  headerRow.height = 28;
  headerRow.eachCell((cellRef) => {
    cellRef.font = { bold: true, color: { argb: DOCUMENT_ARGB.white }, name: "Aptos", size: 9 };
    cellRef.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: DOCUMENT_ARGB.navy },
    };
    cellRef.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cellRef.border = bodyBorder;
  });

  if (input.rows.length === 0) {
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow(["Belum ada data yang tercatat untuk laporan / periode ini."]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    const c = row.getCell(1);
    c.font = { italic: true, size: 10, color: { argb: DOCUMENT_ARGB.muted } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = bodyBorder;
    row.height = 28;
  }

  input.rows.forEach((r, idx) => {
    const isTotal = Boolean(r.__total);
    const row = ws.addRow(
      input.columns.map((c) => cellValue(r, c.key))
    );
    let maxLines = 1;
    row.eachCell((cellRef, col) => {
      const column = input.columns[col - 1];
      cellRef.alignment = {
        vertical: "top",
        wrapText: true,
        horizontal: cellAlign(column),
      };
      cellRef.border = bodyBorder;
      cellRef.font = {
        size: 9,
        bold: isTotal,
        color: { argb: isTotal ? DOCUMENT_ARGB.navy : DOCUMENT_ARGB.text },
        name: "Aptos",
      };
      if (isTotal) {
        cellRef.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: DOCUMENT_ARGB.lightBlue },
        };
      } else if (idx % 2 === 1) {
        cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAFD" } };
      }
      const width = ws.columns[col - 1]?.width ?? 20;
      const text = String(cellRef.value ?? "");
      let lines = 1;
      text.split("\n").forEach((seg) => {
        lines += Math.ceil(seg.length / Math.max(width * 1.15, 8));
      });
      maxLines = Math.max(maxLines, lines);
    });
    row.height = Math.max(22, maxLines * 15 + 6);
  });

  const lastDataRow = headerRowIndex + input.rows.length;
  if (input.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: Math.max(headerRowIndex, lastDataRow), column: input.columns.length },
    };
  }
  ws.views = [{ state: "frozen", ySplit: headerRowIndex }];

  identityRow("RINGKASAN", {
    size: 10,
    bold: true,
    color: DOCUMENT_ARGB.navy,
    align: "left",
    height: 20,
  });
  doc.summary.forEach((item) =>
    identityRow(`${item.label}: ${item.value}`, {
      size: 9,
      align: "left",
      height: 18,
      color: DOCUMENT_ARGB.text,
    })
  );

  identityRow("KETERANGAN", {
    size: 10,
    bold: true,
    color: DOCUMENT_ARGB.navy,
    align: "left",
    height: 20,
  });
  doc.notes.forEach((note, i) =>
    identityRow(`${i + 1}. ${note}`, { size: 9, align: "left", height: 20 })
  );

  identityRow(doc.approval.heading ?? "PENGESAHAN", {
    size: 10,
    bold: true,
    color: DOCUMENT_ARGB.navy,
    align: "left",
    height: 22,
  });
  const signatories = doc.approval.signatories;
  const span = Math.max(1, Math.floor(input.columns.length / signatories.length));
  signatories.forEach((s, i) => {
    const from = i * span + 1;
    const to = i === signatories.length - 1 ? input.columns.length : Math.min(from + span - 1, input.columns.length);
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow([]);
    row.height = 70;
    ws.mergeCells(rowIdx, from, rowIdx, to);
    const c = row.getCell(from);
    c.value = `${s.label.replace(/\n/g, " ")}\n\n\n${s.name}`;
    c.font = { size: 9, name: "Aptos", color: { argb: DOCUMENT_ARGB.text } };
    c.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  });

  identityRow(`${footerIdentity(input.kop)} - Dokumen resmi organisasi`, {
    size: 8,
    italic: true,
    color: DOCUMENT_ARGB.muted,
    height: 18,
  });

  const lastRow = ws.rowCount;
  ws.pageSetup = {
    printArea: `A1:${columnLetter(input.columns.length)}${lastRow}`,
    paperSize: 9,
    orientation: doc.landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = {
    ...ws.headerFooter,
    oddFooter: `&L${footerIdentity(input.kop)}&C${doc.documentType}&RHalaman &P dari &N`,
  };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ------------------------------------ pdf ------------------------------------ */

type RGB = [number, number, number];

function num(n: number): string {
  const s = n.toFixed(2);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

const WINANSI_MAP: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
  "\u2015": "-", "\u2212": "-",
  "\u2018": "'", "\u2019": "'", "\u201A": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"',
  "\u2026": "...", "\u2022": "-", "\u2023": "-",
  "\u2039": "<", "\u203A": ">",
  "\u20AC": "EUR", "\u2122": "(TM)", "\u00D7": "x",
  "\u2219": "-",
  "\u00A0": " ", "\u2007": " ", "\u2009": " ", "\u200B": "",
  "\u00AD": "",
};

function escapePdfText(s: string): string {
  let out = "";
  for (const raw of s) {
    const mapped = WINANSI_MAP[raw] ?? raw;
    for (const ch of mapped) {
      const code = ch.codePointAt(0) ?? 0;
      if (code > 255) {
        out += "?";
        continue;
      }
      if (code === 0x28) { out += "\\("; continue; }
      if (code === 0x29) { out += "\\)"; continue; }
      if (code === 0x5c) { out += "\\\\"; continue; }
      if (code === 0x0a || code === 0x0d) { out += " "; continue; }
      if (code < 32 || code === 127) continue;
      out += ch;
    }
  }
  return out;
}

function textWidth(s: string, size: number, bold: boolean = false): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 32) w += 0.28;
    else if (c >= 65 && c <= 90) w += 0.62;
    else if (c >= 48 && c <= 57) w += 0.52;
    else if ("ilj.,'`:;|!".includes(ch)) w += 0.3;
    else if ("mwMW@%@".includes(ch)) w += 0.68;
    else if (c > 127) w += 0.55;
    else w += 0.5;
  }
  return w * size * (bold ? 1.08 : 1);
}

function hardSplit(word: string, size: number, maxWidth: number, bold: boolean = false): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && textWidth(cur + ch, size, bold) > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [word];
}

function wrapSegment(str: string, size: number, maxWidth: number, bold: boolean = false): string[] {
  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };
  tokens.forEach((token) => {
    let piece = token;
    while (piece && textWidth(line ? `${line} ${piece}` : piece, size, bold) > maxWidth) {
      if (!line) {
        const split = hardSplit(piece, size, maxWidth, bold);
        lines.push(split[0]);
        piece = split.slice(1).join("");
        continue;
      }
      lines.push(line);
      line = "";
    }
    if (piece) line = line ? `${line} ${piece}` : piece;
  });
  flush();
  return lines.length > 0 ? lines : [""];
}

function wrapText(str: string, size: number, maxWidth: number, bold: boolean = false): string[] {
  const out: string[] = [];
  str.split("\n").forEach((seg) => {
    wrapSegment(seg, size, maxWidth, bold).forEach((l) => out.push(l));
  });
  return out.length > 0 ? out : [""];
}

function buildPdfBlob(doc: PreparedDocument): Blob {
  const { input } = doc;
  const PAGE_W = doc.landscape ? 841.89 : 595.28;
  const PAGE_H = doc.landscape ? 595.28 : 841.89;
  const MARGIN_LEFT = doc.landscape ? 36 : 40;
  const MARGIN_RIGHT = doc.landscape ? 36 : 40;
  const MARGIN_TOP = doc.landscape ? 42 : 46;
  const BOTTOM = doc.landscape ? 46 : 50;
  const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

  const rawWidths = input.columns.map((c) => c.width ?? 1);
  const sum = rawWidths.reduce((a, b) => a + b, 0) || 1;
  const widths = rawWidths.map((w) => (w / sum) * CONTENT_W);

  const pages: string[][] = [];
  let ops: string[] = [];
  let topY = MARGIN_TOP;

  function drawText(
    text: string, size: number, bold: boolean, x: number, yTop: number,
    color: RGB, maxWidth: number,
    align: "left" | "center" | "right" = "left",
    fontCode?: "F1" | "F2" | "F3"
  ) {
    const baseline = PAGE_H - yTop - size * 0.82;
    const font = fontCode ?? (bold ? "F2" : "F1");
    const w = textWidth(text, size, font === "F2");
    let tx = x;
    if (align === "center") tx = x + Math.max(0, (maxWidth - w) / 2);
    else if (align === "right") tx = x + Math.max(0, maxWidth - w);
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    ops.push(`BT /${font} ${num(size)} Tf 1 0 0 1 ${num(tx)} ${num(baseline)} Tm (${escapePdfText(text)}) Tj ET`);
  }

  function fillRect(x: number, yTop: number, w: number, h: number, color: RGB) {
    const y = PAGE_H - yTop - h;
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  function strokeRect(x: number, yTop: number, w: number, h: number, color: RGB = DOCUMENT_RGB.border, lineWidth: number = 0.5) {
    const y = PAGE_H - yTop - h;
    ops.push(`${num(lineWidth)} w`);
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} RG`);
    ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`);
  }

  function drawRunningHeader() {
    drawText(input.title, 8, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W * 0.65, "left", "F2");
    drawText(footerIdentity(input.kop), 7.5, false, MARGIN_LEFT + CONTENT_W * 0.65, topY, DOCUMENT_RGB.muted, CONTENT_W * 0.35, "right");
    topY += 11;
    fillRect(MARGIN_LEFT, topY, CONTENT_W, 0.6, DOCUMENT_RGB.border);
    topY += 9;
  }

  function beginPage(running: boolean) {
    ops = [];
    topY = MARGIN_TOP;
    pages.push(ops);
    if (running) drawRunningHeader();
  }
  beginPage(false);

  const HEADER_LINE_H = 10;
  const HEADER_PAD_TOP = 5;
  const HEADER_PAD_BOTTOM = 5;
  const wrappedHeaders = input.columns.map((column, i) =>
    wrapText(column.header, 8.5, widths[i] - 8, true)
  );
  const headerHeight =
    Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * HEADER_LINE_H +
    HEADER_PAD_TOP + HEADER_PAD_BOTTOM;

  function drawHeaderRow() {
    fillRect(MARGIN_LEFT, topY, CONTENT_W, headerHeight, DOCUMENT_RGB.navy);
    input.columns.forEach((_, i) => {
      const x = MARGIN_LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0);
      wrappedHeaders[i].forEach((line, lineIdx) =>
        drawText(line, 8.5, true, x + 4, topY + HEADER_PAD_TOP + lineIdx * HEADER_LINE_H,
          DOCUMENT_RGB.white, widths[i] - 8, "center", "F2")
      );
    });
    topY += headerHeight;
  }

  function newPageForTable() {
    beginPage(true);
    drawHeaderRow();
  }

  // KOP organisasi (selalu tampil; identitas sekolah dari konfigurasi).
  let kopIndent = 0;
  if (doc.logo) {
    const logoW = Math.min(46, doc.logo.width);
    const logoH = logoW * (doc.logo.height / doc.logo.width);
    ops.push("q", `${num(logoW)} 0 0 ${num(logoH)} ${num(MARGIN_LEFT)} ${num(PAGE_H - topY - logoH)} cm`, "/Im0 Do", "Q");
    kopIndent = logoW + 8;
    topY += logoH + 2;
  }
  doc.kop.forEach((line) => {
    drawText(line.text, line.size, line.bold, MARGIN_LEFT + kopIndent, topY,
      line.color === "navy" ? DOCUMENT_RGB.navy : DOCUMENT_RGB.text, CONTENT_W - kopIndent, "center");
    topY += line.size + 3.5;
  });
  topY += 2;
  fillRect(MARGIN_LEFT, topY, CONTENT_W, 1.4, DOCUMENT_RGB.navy);
  fillRect(MARGIN_LEFT, topY + 2.6, CONTENT_W, 0.5, DOCUMENT_RGB.blue);
  topY += 11;

  drawText(input.title, 13.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "center", "F2");
  topY += 17;
  drawText(doc.documentType, 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.blue, CONTENT_W, "center", "F2");
  topY += 13;
  drawText(`Dicetak pada ${todayLabel()}`, 7.5, false, MARGIN_LEFT, topY, DOCUMENT_RGB.muted, CONTENT_W, "center");
  topY += 14;

  // Identitas laporan.
  const metaHeight = doc.metaRows.length * 11 + 10;
  fillRect(MARGIN_LEFT, topY, CONTENT_W, metaHeight, DOCUMENT_RGB.lightBlue);
  doc.metaRows.forEach(([label, value], i) => {
    const y = topY + 5 + i * 11;
    drawText(label, 7.5, true, MARGIN_LEFT + 6, y, DOCUMENT_RGB.navy, CONTENT_W * 0.3, "left", "F2");
    drawText(value, 7.5, false, MARGIN_LEFT + CONTENT_W * 0.31, y, DOCUMENT_RGB.text, CONTENT_W * 0.66);
  });
  strokeRect(MARGIN_LEFT, topY, CONTENT_W, metaHeight, DOCUMENT_RGB.border, 0.5);
  topY += metaHeight + 6;

  // Ringkasan dihitung dari data, bukan angka manual.
  function drawSummary() {
    const lineH = 10.5;
    const h = doc.summary.length * lineH + 14;
    if (topY + h > PAGE_H - BOTTOM) beginPage(true);
    fillRect(MARGIN_LEFT, topY, CONTENT_W, h, DOCUMENT_RGB.lightBlue);
    fillRect(MARGIN_LEFT, topY, 2.5, h, DOCUMENT_RGB.navy);
    drawText("RINGKASAN", 8.5, true, MARGIN_LEFT + 8, topY + 4, DOCUMENT_RGB.navy, CONTENT_W - 16, "left", "F2");
    const perColumn = CONTENT_W / Math.min(2, Math.max(1, Math.ceil(doc.summary.length / 2)));
    doc.summary.forEach((item, i) => {
      const col = Math.min(2, Math.ceil(doc.summary.length / 2));
      const cx = MARGIN_LEFT + 8 + (i % col) * (perColumn - 10);
      const cy = topY + 16 + Math.floor(i / col) * lineH;
      drawText(`${item.label}: ${item.value}`, 7.8, false, cx, cy, DOCUMENT_RGB.text, perColumn - 16);
    });
    strokeRect(MARGIN_LEFT, topY, CONTENT_W, h, DOCUMENT_RGB.border, 0.5);
    topY += h + 12;
  }
  drawText("DATA LAPORAN", 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "left", "F2");
  topY += 14;
  drawHeaderRow();

  const ROW_PAD_X = 5;
  const ROW_PAD_TOP = 4;
  const ROW_PAD_BOTTOM = 4;
  const ROW_LINE_H = 10.5;

  function drawRowCells(isTotal: boolean, isEven: boolean, wrapped: string[][], height: number) {
    if (isTotal) fillRect(MARGIN_LEFT, topY, CONTENT_W, height, DOCUMENT_RGB.lightBlue);
    else if (isEven) fillRect(MARGIN_LEFT, topY, CONTENT_W, height, DOCUMENT_RGB.lightBlue);
    input.columns.forEach((c, i) => {
      const x = MARGIN_LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0);
      strokeRect(x, topY, widths[i], height, DOCUMENT_RGB.border, 0.45);
      wrapped[i].forEach((lineText, lineIdx) =>
        drawText(lineText, 8.2, isTotal, x + ROW_PAD_X,
          topY + ROW_PAD_TOP + lineIdx * ROW_LINE_H,
          isTotal ? DOCUMENT_RGB.navy : DOCUMENT_RGB.text,
          widths[i] - ROW_PAD_X * 2, cellAlign(c), isTotal ? "F2" : "F1")
      );
    });
    topY += height;
  }

  if (input.rows.length === 0) {
    const h = 26;
    fillRect(MARGIN_LEFT, topY, CONTENT_W, h, DOCUMENT_RGB.lightBlue);
    strokeRect(MARGIN_LEFT, topY, CONTENT_W, h, DOCUMENT_RGB.border, 0.5);
    drawText("Belum ada data yang tercatat untuk laporan / periode ini.", 8.5, false,
      MARGIN_LEFT, topY + 7, DOCUMENT_RGB.muted, CONTENT_W, "center", "F3");
    topY += h;
  } else {
    input.rows.forEach((r, rowIdx) => {
      const isTotal = Boolean(r.__total);
      const isEven = rowIdx % 2 === 1;
      const wrapped = input.columns.map((c, i) =>
        wrapText(cellValue(r, c.key), 8.2, widths[i] - ROW_PAD_X * 2, isTotal)
      );
      const lineCount = Math.max(...wrapped.map((l) => l.length), 1);
      const rowHeight = lineCount * ROW_LINE_H + ROW_PAD_TOP + ROW_PAD_BOTTOM;
      const freshPageSpace = PAGE_H - BOTTOM - MARGIN_TOP - 28 - headerHeight - 14;
      let lineOffset = 0;
      if (rowHeight > PAGE_H - BOTTOM - topY - 14 && rowHeight <= freshPageSpace) newPageForTable();
      while (lineOffset < lineCount) {
        const spaceRemaining = PAGE_H - BOTTOM - topY - 14;
        const maxLines = Math.floor((spaceRemaining - ROW_PAD_TOP - ROW_PAD_BOTTOM) / ROW_LINE_H);
        if (maxLines < 1) {
          newPageForTable();
          continue;
        }
        const chunkLineCount = Math.min(lineCount - lineOffset, maxLines);
        const chunk = wrapped.map((lines) => lines.slice(lineOffset, lineOffset + chunkLineCount));
        const chunkHeight = chunkLineCount * ROW_LINE_H + ROW_PAD_TOP + ROW_PAD_BOTTOM;
        drawRowCells(isTotal, isEven, chunk, chunkHeight);
        lineOffset += chunkLineCount;
        if (lineOffset < lineCount) newPageForTable();
      }
    });
  }

  function ensureSpace(height: number) {
    if (topY + height > PAGE_H - BOTTOM) beginPage(true);
  }

  drawSummary();

  // KETERANGAN — informasi asli dari subtitle/filter dipertahankan.
  const noteLines = doc.notes.flatMap((n, i) =>
    wrapText(`${i + 1}. ${n}`, 8, CONTENT_W - 8).map((line, li) => ({ line, indent: li > 0 }))
  );
  const noteHeight = 18 + noteLines.length * 10.5;
  ensureSpace(noteHeight + 90);
  drawText("KETERANGAN", 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "left", "F2");
  topY += 15;
  noteLines.forEach((n, i) =>
    drawText(n.line, 8, false, MARGIN_LEFT + (n.indent ? 12 : 0), topY + i * 10.5, DOCUMENT_RGB.text, CONTENT_W - 12)
  );
  topY += noteHeight - 6;

  // PENGESAHAN — berbeda sesuai kewenangan jenis laporan.
  const signatories = doc.approval.signatories;
  const sigColW = CONTENT_W / signatories.length;
  drawText(doc.approval.heading ?? "PENGESAHAN", 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "left", "F2");
  topY += 18;
  signatories.forEach((s, i) => {
    const x = MARGIN_LEFT + i * sigColW;
    s.label.split("\n").forEach((line, li) =>
      drawText(line, 8, true, x, topY + li * 10, DOCUMENT_RGB.text, sigColW - 8, "left", "F2")
    );
    drawText("........................................", 8, false, x, topY + 28, DOCUMENT_RGB.border, sigColW - 8);
    drawText(s.name, 8.5, true, x, topY + 40, DOCUMENT_RGB.navy, sigColW - 8, "left", "F2");
  });
  topY += 58;

  if (pages.length > 1 && ops.length <= 2) pages.pop();

  const totalPages = pages.length;
  pages.forEach((pageOps, pageIdx) => {
    const yLine = BOTTOM - 12;
    pageOps.push("0.4 w");
    pageOps.push(`${num(DOCUMENT_RGB.border[0])} ${num(DOCUMENT_RGB.border[1])} ${num(DOCUMENT_RGB.border[2])} RG`);
    pageOps.push(`${num(MARGIN_LEFT)} ${num(yLine)} m ${num(PAGE_W - MARGIN_RIGHT)} ${num(yLine)} l S`);
    const baseline = yLine - 10;
    pageOps.push(`${num(DOCUMENT_RGB.muted[0])} ${num(DOCUMENT_RGB.muted[1])} ${num(DOCUMENT_RGB.muted[2])} rg`);
    pageOps.push(`BT /F1 7.5 Tf 1 0 0 1 ${num(MARGIN_LEFT)} ${num(baseline)} Tm (${escapePdfText(footerIdentity(input.kop))}) Tj ET`);
    const center = doc.documentType;
    pageOps.push(`BT /F1 7.5 Tf 1 0 0 1 ${num((PAGE_W - textWidth(center, 7.5)) / 2)} ${num(baseline)} Tm (${escapePdfText(center)}) Tj ET`);
    const pageNumText = `Halaman ${pageIdx + 1} dari ${totalPages}`;
    const txRight = PAGE_W - MARGIN_RIGHT - textWidth(pageNumText, 7.5);
    pageOps.push(`BT /F1 7.5 Tf 1 0 0 1 ${num(txRight)} ${num(baseline)} Tm (${escapePdfText(pageNumText)}) Tj ET`);
  });

  const objects: string[] = [];
  const f1 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>");
  const f2 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>");
  const f3 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding>>");

  let logoId: number | undefined;
  if (doc.logo) {
    const base64 = doc.logo.dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
    let stream = "";
    for (const b of bytes) stream += String.fromCharCode(b);
    logoId = objects.length + 1;
    objects.push(
      `<</Type /XObject /Subtype /Image /Width ${doc.logo.width} /Height ${doc.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${stream.length}>>\nstream\n${stream}\nendstream`
    );
  }

  const contentIds: number[] = [];
  pages.forEach((pageOps) => {
    const id = objects.length + 1;
    const stream = pageOps.join("\n");
    objects.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
    contentIds.push(id);
  });

  const pagesId = objects.length + contentIds.length + 1;
  const pageIds: number[] = [];
  pages.forEach((_, i) => {
    const id = objects.length + 1;
    const xobject = logoId ? ` /XObject <</Im0 ${logoId} 0 R>>` : "";
    objects.push(
      `<</Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Resources <</Font <</F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R>>${xobject}>> /Contents ${contentIds[i]} 0 R>>`
    );
    pageIds.push(id);
  });

  const catalogId = objects.length + 1;
  objects.push(`<</Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}]>>`);
  const rootId = objects.length + 1;
  objects.push(`<</Type /Catalog /Pages ${catalogId} 0 R>>`);

  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [0];
  objects.forEach((body, idx) => {
    offsets[idx + 1] = pdf.length;
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++)
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1} /Root ${rootId} 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

/* -------------------------------- downloader -------------------------------- */

export async function buildExportBlob(options: ExportInput & { format: ExportFormat }): Promise<{
  blob: Blob;
  ext: string;
}> {
  const input: ExportInput = { ...options };
  const doc = await prepareDocument(input);
  if (options.format === "excel") {
    return { blob: await buildExcelBlob(doc), ext: "xlsx" };
  }
  if (options.format === "doc") {
    return {
      blob: await buildDocxBlob(input, {
        kopLines: doc.kop,
        metaRows: doc.metaRows,
        summary: doc.summary,
        notes: doc.notes,
        approval: doc.approval,
        periodLabel: doc.periodLabel,
        documentType: doc.documentType,
      }),
      ext: "docx",
    };
  }
  return { blob: buildPdfBlob(doc), ext: "pdf" };
}

export async function downloadExport(options: ExportInput & { format: ExportFormat }): Promise<void> {
  const base = slugify(options.filename || options.title);
  const { blob, ext } = await buildExportBlob(options);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${base}-${date}.${ext}`);
}
