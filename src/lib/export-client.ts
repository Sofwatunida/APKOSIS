"use client";

import { buildDocxBlob } from "./docx-writer";
import {
  computeSummary,
  DEFAULT_KOP_LOGOS,
  DOCUMENT_ARGB,
  DOCUMENT_PALETTE,
  DOCUMENT_RGB,
  footerIdentity,
  kopLines,
  parseNumeric,
  reportMainTitle,
  reportMetaRows,
  resolveApproval,
  resolveDocumentType,
  type ExportInput,
  type ExportFormat,
  type KopLine,
  type KopLogos,
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
  type KopLogos,
  type LogoImage,
  type SummaryItem,
  DEFAULT_KOP_LOGOS,
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

const LOGO_CACHE = new Map<string, Promise<LogoImage | undefined>>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 24) return undefined;
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!png.every((b, i) => bytes[i] === b)) return undefined;
  return { width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] };
}

/** Ambil file PNG asli dari folder public tanpa menggambar ulang / mengubah warna. */
async function resolveLogo(url?: string): Promise<LogoImage | undefined> {
  if (!url?.trim() || typeof fetch === "undefined") return undefined;
  const key = url.trim();
  const cached = LOGO_CACHE.get(key);
  if (cached) return cached;
  const p = (async () => {
    try {
      const response = await fetch(key);
      if (!response.ok) return undefined;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const mimeType: "image/png" | "image/jpeg" = key.toLowerCase().split("?")[0].endsWith(".png") ? "image/png" : "image/jpeg";
      const dims = mimeType === "image/png" ? pngDimensions(bytes) : undefined;
      if (!dims) return undefined;
      return {
        dataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
        width: dims.width,
        height: dims.height,
        mimeType,
      };
    } catch {
      return undefined;
    }
  })();
  LOGO_CACHE.set(key, p);
  return p;
}

async function resolveKopLogos(input: ExportInput): Promise<KopLogos> {
  const [left, right] = await Promise.all([
    input.kopLogos?.left ?? resolveLogo(DEFAULT_KOP_LOGOS.left),
    input.kopLogos?.right ?? resolveLogo(DEFAULT_KOP_LOGOS.right),
  ]);
  return { left: left ?? input.logo, right };
}

interface PreparedDocument {
  input: ExportInput;
  title: string;
  kop: KopLine[];
  metaRows: [string, string][];
  summary: SummaryItem[];
  approval: ApprovalSpec;
  periodLabel: string;
  documentType: string;
  logo?: LogoImage;
  kopLogos: KopLogos;
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
  const documentType = input.title.toLowerCase().includes("laporan harian")
    ? "LAPORAN HARIAN"
    : input.documentType || resolveDocumentType(input.title);
  const kopLogos = await resolveKopLogos(input);
  return {
    input,
    title: reportMainTitle(input.title),
    kop: kopLines(input.kop),
    metaRows: reportMetaRows(input, periodLabel),
    summary: computeSummary(input.columns, input.rows, input.extraSummary),
    approval: resolveApproval(input.title, input.kop, input.approval),
    periodLabel,
    documentType,
    logo: input.logo ?? (await resolveLogo(input.kop?.logoUrl)),
    kopLogos,
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

const EXCEL_HEADER_ARGB = "FF1F4E79";
const EXCEL_ZEBRA_ARGB = "FFF2F6FA";
const EXCEL_TOTAL_ARGB = "FFDCEBFA";
const EXCEL_BORDER_ARGB = "FFD0D7DE";

function isDateColumn(col: ExportInput["columns"][number], rows: Record<string, unknown>[]): boolean {
  const key = `${col.key} ${col.header}`.toLowerCase();
  if (/tanggal|date|waktu|periode/.test(key)) return true;
  const vals = rows.filter((r) => !r.__total).map((r) => String(r[col.key] ?? "").trim()).filter(Boolean).slice(0, 12);
  return vals.length > 0 && vals.every((v) => /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?$/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) || /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/i.test(v));
}

function isNumericColumn(col: ExportInput["columns"][number], rows: Record<string, unknown>[]): boolean {
  if (col.align === "right") return true;
  const key = `${col.key} ${col.header}`.toLowerCase();
  if (/nominal|jumlah|saldo|total|harga|dana|pemasukan|pengeluaran|nilai|qty|kuantitas/.test(key)) return true;
  const vals = rows.filter((r) => !r.__total).map((r) => r[col.key]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "").slice(0, 12);
  return vals.length > 0 && vals.every((v) => typeof v === "number" || parseNumeric(v) !== null);
}

function excelDisplayValue(col: ExportInput["columns"][number], row: Record<string, unknown>, dateCol: boolean, numericCol: boolean): string | number {
  const raw = row[col.key];
  if (raw === null || raw === undefined || raw === "") return "-";
  if (!dateCol && numericCol && !row.__total && typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (!dateCol && numericCol && typeof raw === "string") {
    const n = parseNumeric(raw);
    if (n !== null && /rp\b|[\d.,]/i.test(raw)) return raw.replace(/^Rp\s*/i, "Rp ").trim();
  }
  return prepText(String(raw));
}

function excelColumnWidth(col: ExportInput["columns"][number], rows: Record<string, unknown>[], dateCol: boolean, numericCol: boolean): number {
  const headerLen = Math.max(col.header.length, 8);
  const sample = rows.slice(0, 60).map((r) => String(excelDisplayValue(col, r, dateCol, numericCol) ?? "").replace(/\n/g, " "));
  const contentLen = sample.reduce((max, v) => Math.max(max, Math.min(v.length, 60)), 0);
  const base = Math.max(headerLen, contentLen);
  const pad = numericCol ? 2 : 3;
  const max = /deskripsi|keterangan|kendala|solusi|catatan|uraian|tujuan|hasil|detail|alamat/.test(`${col.key} ${col.header}`.toLowerCase()) ? 52 : 34;
  return Math.min(Math.max(base + pad, 10), max);
}

async function buildExcelBlob(doc: PreparedDocument): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const { input } = doc;
  const wb = new ExcelJS.Workbook();
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  const ws = wb.addWorksheet("Data", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2", activeCell: "A2", showGridLines: false, zoomScale: 100, zoomScaleNormal: 100 }],
  });

  const dateCols = input.columns.map((c) => isDateColumn(c, input.rows));
  const numericCols = input.columns.map((c) => !dateCols[input.columns.indexOf(c)] && isNumericColumn(c, input.rows));
  ws.columns = input.columns.map((c, i) => ({
    key: c.key,
    width: excelColumnWidth(c, input.rows, dateCols[i], numericCols[i]),
  }));

  const thin = { style: "thin" as const, color: { argb: EXCEL_BORDER_ARGB } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  const headerRow = ws.addRow(input.columns.map((c) => c.header));
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });

  if (input.rows.length === 0) {
    const rowIdx = ws.rowCount + 1;
    const row = ws.addRow(["Tidak ada data"]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    const c = row.getCell(1);
    c.font = { italic: true, size: 11, color: { argb: "FF64748B" }, name: "Calibri" };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = border;
    row.height = 24;
  }

  input.rows.forEach((r, idx) => {
    const isTotal = Boolean(r.__total);
    const row = ws.addRow(input.columns.map((c, i) => excelDisplayValue(c, r, dateCols[i], numericCols[i])));
    let maxLines = 1;
    row.eachCell((cell, colNum) => {
      const col = input.columns[colNum - 1];
      const text = String(cell.value ?? "");
      const width = ws.columns[colNum - 1]?.width ?? 16;
      const lines = text.split("\n").reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / Math.max(width - 1, 8))), 0);
      maxLines = Math.max(maxLines, lines);
      cell.border = border;
      cell.font = { name: "Calibri", size: 11, bold: isTotal, color: { argb: isTotal ? EXCEL_HEADER_ARGB : "FF1F2937" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isTotal ? EXCEL_TOTAL_ARGB : idx % 2 === 1 ? EXCEL_ZEBRA_ARGB : "FFFFFFFF" } };
      cell.alignment = {
        vertical: "top",
        horizontal: col.align === "right" || numericCols[colNum - 1] ? "right" : col.align === "center" || dateCols[colNum - 1] ? "center" : "left",
        wrapText: true,
      };
      if (typeof cell.value === "number") cell.numFmt = "0";
    });
    row.height = Math.max(22, Math.min(maxLines, 8) * 15 + 6);
  });

  const lastRow = Math.max(ws.rowCount, 1);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: input.columns.length } };

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

function bytesToStream(bytes: Uint8Array): string {
  let stream = "";
  for (const byte of bytes) stream += String.fromCharCode(byte);
  return stream;
}

async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const part = bytes.slice().buffer as ArrayBuffer;
  const stream = new Blob([part]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const part = bytes.slice().buffer as ArrayBuffer;
  const stream = new Blob([part]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function unfilterScanlines(data: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let offset = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = data[offset++];
    const row = data.slice(offset, offset + stride);
    offset += stride;
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let value = row[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error("Unsupported PNG filter");
      cur[x] = value & 0xff;
    }
    out.set(cur, y * stride);
    prev = cur;
  }
  return out;
}

function parsePngForPdf(bytes: Uint8Array):
  | { width: number; height: number; colorType: number; idat: Uint8Array }
  | undefined {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((b, i) => bytes[i] === b)) return undefined;
  let offset = 8;
  let header: { width: number; height: number; colorType: number } | undefined;
  const idatChunks: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      if (data[8] !== 8 || data[12] !== 0) return undefined;
      header = {
        width: (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3],
        height: (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7],
        colorType: data[9],
      };
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header || idatChunks.length === 0 || ![2, 6].includes(header.colorType)) return undefined;
  const idatLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const idat = new Uint8Array(idatLength);
  let idatOffset = 0;
  idatChunks.forEach((chunk) => {
    idat.set(chunk, idatOffset);
    idatOffset += chunk.length;
  });
  return { ...header, idat };
}

function streamObject(dict: Record<string, string>, bytes: Uint8Array): string {
  const attrs = Object.entries(dict).map(([key, value]) => `${key} ${value}`).join(" ");
  return `<</Type /XObject /Subtype /Image ${attrs} /Length ${bytes.length}>>\nstream\n${bytesToStream(bytes)}\nendstream`;
}

async function buildPdfBlob(doc: PreparedDocument): Promise<Blob> {
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
    drawText(doc.title, 8, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W * 0.65, "left", "F2");
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

  // KOP surat resmi OSIS/IP4A: logo kiri/kanan + teks tengah + garis tegas.
  const kopStartY = topY;
  const logoBox = 62;
  const textX = MARGIN_LEFT + logoBox + 10;
  const textW = CONTENT_W - (logoBox + 10) * 2;
  const drawKopLogo = (logo: LogoImage | undefined, x: number, imageName: "/ImLeft" | "/ImRight") => {
    if (!logo) return;
    const scale = Math.min(logoBox / logo.width, logoBox / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    const lx = x + (logoBox - w) / 2;
    const ly = kopStartY + (logoBox - h) / 2;
    ops.push("q", `${num(w)} 0 0 ${num(h)} ${num(lx)} ${num(PAGE_H - ly - h)} cm`, `${imageName} Do`, "Q");
  };
  drawKopLogo(doc.kopLogos.left, MARGIN_LEFT, "/ImLeft");
  drawKopLogo(doc.kopLogos.right, MARGIN_LEFT + CONTENT_W - logoBox, "/ImRight");

  let textY = kopStartY + 1;
  doc.kop.forEach((line) => {
    const color = line.color === "navy" ? DOCUMENT_RGB.navy : DOCUMENT_RGB.text;
    const lines = wrapText(line.text, line.size, textW, line.bold);
    lines.forEach((lineText) => {
      drawText(lineText, line.size, line.bold, textX, textY, color, textW, "center", "F2");
      textY += line.size + 4.2;
    });
  });
  const kopBottom = Math.max(kopStartY + logoBox, textY);
  topY = kopBottom + 4;
  fillRect(MARGIN_LEFT, topY, CONTENT_W, 1.8, [0, 0, 0]);
  topY += 14;

  if (doc.title !== "LAPORAN HARIAN") {
    drawText(doc.title, 13.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "center", "F2");
    topY += 17;
  }
  if (doc.documentType !== doc.title) {
    drawText(doc.documentType, 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.blue, CONTENT_W, "center", "F2");
    topY += 14;
  }

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

  function drawSummary() {
    if (doc.summary.length === 0) return;
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

  // PENGESAHAN — dua kolom: pengaju di kiri dan pihak mengetahui di kanan.
  ensureSpace(100);
  topY += 12;
  const signatories = doc.approval.signatories;
  const sigColW = CONTENT_W / signatories.length;
  drawText(doc.approval.heading ?? "PENGESAHAN", 8.5, true, MARGIN_LEFT, topY, DOCUMENT_RGB.navy, CONTENT_W, "left", "F2");
  topY += 18;
  signatories.forEach((s, i) => {
    const blockW = Math.min(sigColW, 190);
    const x = signatories.length === 1
      ? MARGIN_LEFT + CONTENT_W - blockW
      : MARGIN_LEFT + i * (CONTENT_W - blockW);
    s.label.split("\n").forEach((line, li) =>
      drawText(line, 8, true, x, topY + li * 10, DOCUMENT_RGB.text, blockW, "left", "F2")
    );
    drawText("........................................", 8, false, x, topY + 28, DOCUMENT_RGB.border, blockW);
    if (s.name.trim()) {
      drawText(s.name, 8.5, true, x, topY + 40, DOCUMENT_RGB.navy, blockW, "left", "F2");
    }
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
    const pageNumText = String(pageIdx + 1);
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

  async function addImageObject(logo?: LogoImage): Promise<number | undefined> {
    if (!logo) return undefined;
    const base64 = logo.dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
    if (logo.mimeType === "image/png" || logo.dataUrl.startsWith("data:image/png")) {
      const png = parsePngForPdf(bytes);
      if (!png) return undefined;
      const raw = unfilterScanlines(await inflateBytes(png.idat), png.width, png.height, png.colorType === 6 ? 4 : 3);
      const rgb = new Uint8Array(png.width * png.height * 3);
      const alpha = png.colorType === 6 ? new Uint8Array(png.width * png.height) : undefined;
      const channels = png.colorType === 6 ? 4 : 3;
      for (let i = 0, p = 0; i < raw.length; i += channels, p += 3) {
        rgb[p] = raw[i];
        rgb[p + 1] = raw[i + 1];
        rgb[p + 2] = raw[i + 2];
        if (alpha) alpha[p / 3] = raw[i + 3];
      }
      const filter: Record<string, string> = typeof CompressionStream === "undefined" ? {} : { "/Filter": "/FlateDecode" };
      const rgbStream = await deflateBytes(rgb);
      const filterAttrs = Object.entries(filter).map(([k, v]) => `${k} ${v}`).join(" ");
      if (alpha) {
        const alphaStream = await deflateBytes(alpha!);
        const smaskId = objects.length + 1;
        objects.push(streamObject({ "/Width": `${png.width}`, "/Height": `${png.height}`, "/ColorSpace": "/DeviceGray", "/BitsPerComponent": "8", ...filter }, alphaStream));
        const imageId = objects.length + 1;
        objects.push(streamObject({ "/Width": `${png.width}`, "/Height": `${png.height}`, "/ColorSpace": "/DeviceRGB", "/BitsPerComponent": "8", "/SMask": `${smaskId} 0 R`, ...filter }, rgbStream));
        return imageId;
      }
      const imageId = objects.length + 1;
      objects.push(streamObject({ "/Width": `${png.width}`, "/Height": `${png.height}`, "/ColorSpace": "/DeviceRGB", "/BitsPerComponent": "8", ...filter }, rgbStream));
      return imageId;
    }
    const imageId = objects.length + 1;
    objects.push(streamObject({ "/Width": `${logo.width}`, "/Height": `${logo.height}`, "/ColorSpace": "/DeviceRGB", "/BitsPerComponent": "8", "/Filter": "/DCTDecode" }, bytes));
    return imageId;
  }
  const logoId = await addImageObject(doc.logo);
  const leftLogoId = await addImageObject(doc.kopLogos.left);
  const rightLogoId = await addImageObject(doc.kopLogos.right);

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
    const xobjs = [
      logoId ? `/Im0 ${logoId} 0 R` : "",
      leftLogoId ? `/ImLeft ${leftLogoId} 0 R` : "",
      rightLogoId ? `/ImRight ${rightLogoId} 0 R` : "",
    ].filter(Boolean).join(" ");
    const xobject = xobjs ? ` /XObject <<${xobjs}>>` : "";
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
  if (options.format === "excel") {
    return { blob: await buildExcelBlob({ input } as PreparedDocument), ext: "xlsx" };
  }
  const doc = await prepareDocument(input);
  if (options.format === "doc") {
    return {
      blob: await buildDocxBlob(input, {
        kopLines: doc.kop,
        metaRows: doc.metaRows,
        summary: doc.summary,
        approval: doc.approval,
        periodLabel: doc.periodLabel,
        documentType: doc.documentType,
        kopLogos: doc.kopLogos,
        footerIdentity: footerIdentity(input.kop),
      }),
      ext: "docx",
    };
  }
  return { blob: await buildPdfBlob(doc), ext: "pdf" };
}

export async function downloadExport(options: ExportInput & { format: ExportFormat }): Promise<void> {
  const base = slugify(options.filename || options.title);
  const { blob, ext } = await buildExportBlob(options);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${base}-${date}.${ext}`);
}
