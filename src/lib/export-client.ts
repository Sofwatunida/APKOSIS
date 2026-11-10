"use client";

import type { SchoolKop } from "./school-config";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface ExportInput {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  filename: string;
  /** KOP surat sekolah; opsional, dicetak di atas judul. */
  kop?: SchoolKop;
  /** Orientasi kertas PDF: portrait, landscape, atau auto (default). */
  orientation?: "portrait" | "landscape" | "auto";
}

export type ExportFormat = "pdf" | "doc" | "excel";

interface DownloadOptions extends ExportInput {
  format: ExportFormat;
}

/* ------------------------------ shared values ------------------------------ */

const BRAND_HEX = "#4338ca"; // Indigo-700 profesional APKOSIS
const BRAND_ARGB = "FF4338CA";
const HEADER_BORDER_HEX = "#3730a3";
const BODY_BORDER_HEX = "#cbd5e1";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Normalisasi teks supaya konsisten di semua format (bullet, newline, dll)
function prepText(value: string): string {
  return value
    .replace(/[•▪◦●]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ");
}

function cellValue(row: Record<string, unknown> | undefined, key: string): string {
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

function todayLabel(): string {
  const d = new Date();
  const date = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Baris KOP yang tidak kosong (substansi, alamat, kontak). */
interface KopLine {
  text: string;
  size: number;
  bold: boolean;
}

function kopLines(kop?: SchoolKop): KopLine[] {
  if (!kop) return [];
  const lines: KopLine[] = [];
  if (kop.namaSekolah?.trim())
    lines.push({ text: kop.namaSekolah.trim(), size: 14, bold: true });
  if (kop.substansi?.trim())
    lines.push({ text: kop.substansi.trim(), size: 10, bold: false });
  if (kop.alamat?.trim())
    lines.push({ text: kop.alamat.trim(), size: 8.5, bold: false });
  if (kop.kontak?.trim())
    lines.push({ text: kop.kontak.trim(), size: 8, bold: false });
  return lines;
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

function columnRatios(columns: ExportColumn[]): number[] {
  const widths = columns.map((c) => c.width ?? 1);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => w / total);
}

function cellAlign(c: ExportColumn): "left" | "right" | "center" {
  return c.align === "right" ? "right" : c.align === "center" ? "center" : "left";
}

/* ----------------------------------- excel ----------------------------------- */

async function buildExcelBlob(input: ExportInput): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  const ratios = columnRatios(input.columns);

  ws.columns = input.columns.map((c, i) => ({
    key: c.key,
    width: Math.min(Math.max(Math.round(ratios[i] * 48), 12), 56),
  }));

  const bodyBorder = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };

  const headerBorder = {
    top: { style: "thin" as const, color: { argb: "FF3730A3" } },
    left: { style: "thin" as const, color: { argb: "FF3730A3" } },
    bottom: { style: "thin" as const, color: { argb: "FF3730A3" } },
    right: { style: "thin" as const, color: { argb: "FF3730A3" } },
  };

  let rowIdx = 0;

  // KOP surat (nama sekolah + alamat + kontak), bila dikonfigurasi.
  const kop = kopLines(input.kop);
  kop.forEach((line, i) => {
    rowIdx += 1;
    const r = ws.addRow([line.text]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    const cell = r.getCell(1);
    cell.font = { bold: line.bold, size: line.size, color: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    r.height = i === 0 ? 22 : 15;
  });
  if (kop.length > 0) {
    rowIdx += 1;
    // Garis pemisah KOP.
    const rule = ws.addRow([""]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    rule.getCell(1).border = {
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
    };
    rule.height = 6;
  }

  rowIdx += 1;
  const titleRow = ws.addRow([input.title]);
  ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 26;

  let headerIndex = rowIdx + 1;
  if (input.subtitle) {
    rowIdx += 1;
    const subRow = ws.addRow([input.subtitle]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    subRow.getCell(1).value = input.subtitle;
    subRow.getCell(1).font = { size: 10, italic: true, color: { argb: "FF64748B" } };
    subRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 16;
    headerIndex = rowIdx + 1;
  }

  const headerRow = ws.addRow(input.columns.map((c) => c.header));
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = headerBorder;
  });

  const keys = input.columns.map((c) => c.key);

  if (input.rows.length === 0) {
    rowIdx = ws.rowCount + 1;
    const emptyRow = ws.addRow(["Belum ada data yang tercatat untuk laporan / periode ini."]);
    ws.mergeCells(rowIdx, 1, rowIdx, input.columns.length);
    const cell = emptyRow.getCell(1);
    cell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = bodyBorder;
    emptyRow.height = 26;
  } else {
    input.rows.forEach((r, idx) => {
      const isTotal = Boolean((r as Record<string, unknown>).__total);
      const isEven = idx % 2 === 1;
      const row = ws.addRow(keys.map((k) => cellValue(r, k)));
      let maxLines = 1;
      row.eachCell((cell, col) => {
        const colIdx = col - 1;
        cell.alignment = {
          vertical: "top",
          wrapText: true,
          horizontal: cellAlign(input.columns[colIdx] ?? { header: "", key: "" }),
        };
        cell.border = bodyBorder;
        if (isTotal) {
          cell.font = { bold: true, color: { argb: "FF1E1B4B" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
        } else if (isEven) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
        const width = ws.columns[colIdx]?.width ?? 20;
        const text = String(cell.value ?? "");
        let lines = 1;
        text.split("\n").forEach((seg) => {
          lines += Math.ceil(seg.length / Math.max(width * 1.2, 8));
        });
        maxLines = Math.max(maxLines, lines);
      });
      row.height = Math.max(20, maxLines * 15 + 6);
    });
  }

  ws.views = [{ state: "frozen", ySplit: headerIndex }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ------------------------------------ doc ------------------------------------ */

function buildDocBlob(input: ExportInput): Blob {
  const ratios = columnRatios(input.columns);
  const pct = ratios.map((r) => (r * 100).toFixed(2));

  const colgroup = input.columns
    .map((_, i) => `<col width="${pct[i]}%" />`)
    .join("");

  const headerCells = input.columns
    .map(
      (c, i) =>
        `<th width="${pct[i]}%" style="border:1pt solid ${HEADER_BORDER_HEX};background-color:${BRAND_HEX};color:#ffffff;padding:6pt 8pt;font-weight:bold;text-align:center;vertical-align:middle;">${escapeHtml(
          c.header
        )}</th>`
    )
    .join("");

  let bodyRows = "";
  if (input.rows.length === 0) {
    bodyRows = `<tr><td colspan="${input.columns.length}" style="border:1pt solid ${BODY_BORDER_HEX};padding:12pt 8pt;text-align:center;font-style:italic;color:#64748b;background-color:#f8fafc;">Belum ada data yang tercatat untuk laporan / periode ini.</td></tr>`;
  } else {
    bodyRows = input.rows
      .map((r, idx) => {
        const isTotal = Boolean((r as Record<string, unknown>).__total);
        const isEven = idx % 2 === 1;
        const bg = isTotal ? "background-color:#eef2ff;font-weight:bold;" : isEven ? "background-color:#f8fafc;" : "";
        const tds = input.columns
          .map((c, i) => {
            const html = cellValue(r, c.key)
              .split("\n")
              .map((line) => escapeHtml(line))
              .join("<br/>");
            return `<td width="${pct[i]}%" style="border:1pt solid ${BODY_BORDER_HEX};${bg}padding:5pt 8pt;text-align:${cellAlign(
              c
            )};vertical-align:top;">${html ? html : "&nbsp;"}</td>`;
          })
          .join("");
        return `<tr${isTotal ? ' class="total"' : ""}>${tds}</tr>`;
      })
      .join("");
  }

  const subtitleHtml = input.subtitle
    ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>`
    : "";

  const kopArr = kopLines(input.kop);
  let kopHtml = "";
  if (kopArr.length > 0) {
    kopHtml = `<div class="kop">`;
    kopArr.forEach((line) => {
      kopHtml += `<p class="kop-line" style="font-size:${line.size}pt;font-weight:${
        line.bold ? "bold" : "normal"
      };margin:0;">${escapeHtml(line.text)}</p>`;
    });
    kopHtml += `</div><div class="kop-rule"></div>`;
  }

  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 1.8cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 4pt; }
  .subtitle { text-align: center; font-size: 9.5pt; color: #475569; margin: 0 0 2pt; }
  .meta { text-align: center; font-size: 8pt; color: #64748b; margin: 0 0 10pt; }
  .kop { text-align: center; margin: 0 0 2pt; }
  .kop-rule { border-bottom: 2pt solid #0f172a; border-top: 0.5pt solid #0f172a; height: 2pt; margin: 3pt 0 10pt; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; mso-table-layout-alt: fixed; }
  td, th { mso-padding-alt: 0in 0in 0in 0in; }
  tr.total td { font-weight: bold; background-color: #eef2ff; color: #1e1b4b; }
</style>
</head>
<body>
${kopHtml}
<h1>${escapeHtml(input.title)}</h1>
${subtitleHtml}
<p class="meta">Dicetak pada ${escapeHtml(todayLabel())}</p>
<table border="1" cellpadding="0" cellspacing="0">
<colgroup>${colgroup}</colgroup>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;

  return new Blob(["\ufeff", doc], {
    type: "application/msword;charset=utf-8",
  });
}

/* ------------------------------------ pdf ------------------------------------ */

type RGB = [number, number, number];

const COLOR_TEXT: RGB = [0.06, 0.09, 0.16]; // slate-900
const COLOR_MUTED: RGB = [0.38, 0.44, 0.52]; // slate-500
const COLOR_HEADER_BG: RGB = [0.263, 0.220, 0.792]; // #4338ca (Brand Indigo-700)
const COLOR_HEADER_BORDER: RGB = [0.216, 0.188, 0.639]; // #3730a3
const COLOR_BORDER: RGB = [0.796, 0.835, 0.882]; // #cbd5e1
const COLOR_ZEBRA_BG: RGB = [0.973, 0.980, 0.988]; // #f8fafc
const COLOR_TOTAL_BG: RGB = [0.933, 0.949, 1.0]; // #eef2ff
const COLOR_FOOTER_LINE: RGB = [0.886, 0.910, 0.941]; // #e2e8f0

function num(n: number): string {
  const s = n.toFixed(2);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

// Pemetaan karakter typographic Unicode -> ASCII aman
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
      if (code === 0x28) {
        out += "\\(";
        continue;
      }
      if (code === 0x29) {
        out += "\\)";
        continue;
      }
      if (code === 0x5c) {
        out += "\\\\";
        continue;
      }
      if (code === 0x0a || code === 0x0d) {
        out += " ";
        continue;
      }
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

function buildPdfBlob(input: ExportInput): Blob {
  // Tentukan orientasi: jika kolom >= 6 atau diminta landscape -> gunakan Landscape.
  const isLandscape =
    input.orientation === "landscape" ||
    (input.orientation !== "portrait" && input.columns.length >= 6);

  // A4 dalam points: Portrait 595.28 x 841.89 | Landscape 841.89 x 595.28
  const PAGE_W = isLandscape ? 841.89 : 595.28;
  const PAGE_H = isLandscape ? 595.28 : 841.89;

  const MARGIN_LEFT = isLandscape ? 36 : 40;
  const MARGIN_RIGHT = isLandscape ? 36 : 40;
  const MARGIN_TOP = isLandscape ? 34 : 38;
  const BOTTOM = isLandscape ? 36 : 40;
  const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

  const rawWidths = input.columns.map((c) => c.width ?? 1);
  const sum = rawWidths.reduce((a, b) => a + b, 0) || 1;
  const widths = rawWidths.map((w) => (w / sum) * CONTENT_W);

  const pages: string[][] = [];
  let ops: string[] = [];
  let topY = MARGIN_TOP;

  function beginPage() {
    ops = [];
    topY = MARGIN_TOP;
    pages.push(ops);
  }
  beginPage();

  function drawText(
    text: string,
    size: number,
    bold: boolean,
    x: number,
    yTop: number,
    color: RGB,
    maxWidth: number,
    align: "left" | "center" | "right" = "left",
    fontCode?: "F1" | "F2" | "F3"
  ) {
    const baseline = PAGE_H - yTop - size * 0.82;
    const font = fontCode ?? (bold ? "F2" : "F1");
    const isFontBold = font === "F2";
    const w = textWidth(text, size, isFontBold);
    let tx = x;
    if (align === "center") {
      tx = x + Math.max(0, (maxWidth - w) / 2);
    } else if (align === "right") {
      tx = x + Math.max(0, maxWidth - w);
    }
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    ops.push(
      `BT /${font} ${num(size)} Tf 1 0 0 1 ${num(tx)} ${num(baseline)} Tm (${escapePdfText(text)}) Tj ET`
    );
  }

  function fillRect(x: number, yTop: number, w: number, h: number, color: RGB) {
    const y = PAGE_H - yTop - h;
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} rg`);
    ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  function strokeRect(
    x: number,
    yTop: number,
    w: number,
    h: number,
    color: RGB = COLOR_BORDER,
    lineWidth: number = 0.5
  ) {
    const y = PAGE_H - yTop - h;
    ops.push(`${num(lineWidth)} w`);
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} RG`);
    ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`);
  }

  const HEADER_LINE_H = 10;
  const HEADER_PAD_TOP = 5;
  const HEADER_PAD_BOTTOM = 5;
  const wrappedHeaders = input.columns.map((column, i) =>
    wrapText(column.header, 8.5, widths[i] - 8, true)
  );
  const headerHeight =
    Math.max(...wrappedHeaders.map((lines) => lines.length), 1) *
      HEADER_LINE_H +
    HEADER_PAD_TOP +
    HEADER_PAD_BOTTOM;

  function drawHeaderRow() {
    fillRect(MARGIN_LEFT, topY, CONTENT_W, headerHeight, COLOR_HEADER_BG);
    input.columns.forEach((c, i) => {
      const x = MARGIN_LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0);
      wrappedHeaders[i].forEach((line, lineIdx) => {
        drawText(
          line,
          8.5,
          true,
          x + 4,
          topY + HEADER_PAD_TOP + lineIdx * HEADER_LINE_H,
          [1, 1, 1],
          widths[i] - 8,
          "center",
          "F2"
        );
      });
    });
    strokeRect(MARGIN_LEFT, topY, CONTENT_W, headerHeight, COLOR_HEADER_BORDER, 0.7);
    topY += headerHeight;
  }

  // KOP surat sekolah (nama + alamat + kontak), bila dikonfigurasi.
  const kopArr = kopLines(input.kop);
  if (kopArr.length > 0) {
    kopArr.forEach((line) => {
      drawText(
        line.text,
        line.size,
        line.bold,
        MARGIN_LEFT,
        topY,
        line.bold ? COLOR_TEXT : COLOR_MUTED,
        CONTENT_W,
        "center"
      );
      topY += line.size + 3.5;
    });
    // Garis ganda KOP resmi
    topY += 2;
    fillRect(MARGIN_LEFT, topY, CONTENT_W, 1.4, COLOR_TEXT);
    fillRect(MARGIN_LEFT, topY + 2.4, CONTENT_W, 0.5, COLOR_TEXT);
    topY += 10;
  }

  drawText(input.title, 13.5, true, MARGIN_LEFT, topY, COLOR_TEXT, CONTENT_W, "center", "F2");
  topY += 17;
  if (input.subtitle) {
    drawText(input.subtitle, 9, false, MARGIN_LEFT, topY, COLOR_MUTED, CONTENT_W, "center");
    topY += 13;
  }
  drawText(`Dicetak pada ${todayLabel()}`, 7.5, false, MARGIN_LEFT, topY, COLOR_MUTED, CONTENT_W, "center");
  topY += 15;

  drawHeaderRow();

  const ROW_PAD_X = 5;
  const ROW_PAD_TOP = 4;
  const ROW_PAD_BOTTOM = 4;
  const ROW_LINE_H = 10.5;

  function drawRowCells(
    isTotal: boolean,
    isEven: boolean,
    wrapped: string[][],
    height: number
  ) {
    // Fill background baris
    if (isTotal) {
      fillRect(MARGIN_LEFT, topY, CONTENT_W, height, COLOR_TOTAL_BG);
    } else if (isEven) {
      fillRect(MARGIN_LEFT, topY, CONTENT_W, height, COLOR_ZEBRA_BG);
    }

    // Tulis teks & border per sel
    input.columns.forEach((c, i) => {
      const x = MARGIN_LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0);
      strokeRect(x, topY, widths[i], height, COLOR_BORDER, 0.45);
      const lines = wrapped[i];
      lines.forEach((lineText, lineIdx) => {
        drawText(
          lineText,
          8.2,
          isTotal,
          x + ROW_PAD_X,
          topY + ROW_PAD_TOP + lineIdx * ROW_LINE_H,
          isTotal ? [0.12, 0.11, 0.29] : COLOR_TEXT,
          widths[i] - ROW_PAD_X * 2,
          cellAlign(c),
          isTotal ? "F2" : "F1"
        );
      });
    });
    topY += height;
  }

  // Jika baris kosong: tampilkan "Belum ada data" secara wajar, bukan halaman kosong
  if (input.rows.length === 0) {
    const emptyH = 26;
    fillRect(MARGIN_LEFT, topY, CONTENT_W, emptyH, COLOR_ZEBRA_BG);
    strokeRect(MARGIN_LEFT, topY, CONTENT_W, emptyH, COLOR_BORDER, 0.5);
    drawText(
      "Belum ada data yang tercatat untuk laporan / periode ini.",
      8.5,
      false,
      MARGIN_LEFT,
      topY + 7,
      COLOR_MUTED,
      CONTENT_W,
      "center",
      "F3"
    );
    topY += emptyH;
  } else {
    // Render setiap baris data secara utuh (tidak memotong baris menjadi dua halaman)
    input.rows.forEach((r, rowIdx) => {
      const isTotal = Boolean((r as Record<string, unknown>).__total);
      const isEven = rowIdx % 2 === 1;
      const wrapped = input.columns.map((c, i) =>
        wrapText(cellValue(r, c.key), 8.2, widths[i] - ROW_PAD_X * 2, isTotal)
      );
      const lineCount = Math.max(...wrapped.map((l) => l.length), 1);
      const rowHeight = lineCount * ROW_LINE_H + ROW_PAD_TOP + ROW_PAD_BOTTOM;
      const freshPageSpace =
        PAGE_H - BOTTOM - MARGIN_TOP - headerHeight - 14;
      let lineOffset = 0;

      // Jaga baris tetap utuh bila muat pada halaman baru; baris yang lebih
      // panjang dari satu halaman akan dibagi tanpa menghilangkan teks.
      if (
        rowHeight > PAGE_H - BOTTOM - topY - 14 &&
        rowHeight <= freshPageSpace
      ) {
        beginPage();
        drawHeaderRow();
      }

      while (lineOffset < lineCount) {
        const spaceRemaining = PAGE_H - BOTTOM - topY - 14;
        const maxLines =
          Math.floor(
            (spaceRemaining - ROW_PAD_TOP - ROW_PAD_BOTTOM) / ROW_LINE_H
          );
        if (maxLines < 1) {
          beginPage();
          drawHeaderRow();
          continue;
        }

        const chunkLineCount = Math.min(lineCount - lineOffset, maxLines);
        const chunk = wrapped.map((lines) =>
          lines.slice(lineOffset, lineOffset + chunkLineCount)
        );
        const chunkHeight =
          chunkLineCount * ROW_LINE_H + ROW_PAD_TOP + ROW_PAD_BOTTOM;
        drawRowCells(isTotal, isEven, chunk, chunkHeight);
        lineOffset += chunkLineCount;

        if (lineOffset < lineCount) {
          beginPage();
          drawHeaderRow();
        }
      }
    });
  }

  // ---------- Assembly Footer & Nomor Halaman di SEMUA Halaman ----------
  // Buang halaman terakhir jika kosong tanpa isi
  if (pages.length > 1 && ops.length <= 1) {
    pages.pop();
  }

  const totalPages = pages.length;
  pages.forEach((pageOps, pageIdx) => {
    // Garis tipis footer
    const footerLineY = PAGE_H - BOTTOM + 12;
    const yLine = PAGE_H - footerLineY;
    pageOps.push("0.4 w");
    pageOps.push(`${num(COLOR_FOOTER_LINE[0])} ${num(COLOR_FOOTER_LINE[1])} ${num(COLOR_FOOTER_LINE[2])} RG`);
    pageOps.push(`${num(MARGIN_LEFT)} ${num(yLine)} m ${num(PAGE_W - MARGIN_RIGHT)} ${num(yLine)} l S`);

    // Teks kiri footer: Identitas APKOSIS
    const footerTextY = PAGE_H - BOTTOM + 18;
    const baseline = PAGE_H - footerTextY - 7.5 * 0.82;
    pageOps.push(`${num(COLOR_MUTED[0])} ${num(COLOR_MUTED[1])} ${num(COLOR_MUTED[2])} rg`);
    pageOps.push(
      `BT /F1 7.5 Tf 1 0 0 1 ${num(MARGIN_LEFT)} ${num(baseline)} Tm (${escapePdfText(
        "APKOSIS - Sistem Informasi & Pelaporan OSIS"
      )}) Tj ET`
    );

    // Teks kanan footer: Nomor Halaman
    const pageNumText = `Halaman ${pageIdx + 1} dari ${totalPages}`;
    const pageNumW = textWidth(pageNumText, 7.5, false);
    const txRight = PAGE_W - MARGIN_RIGHT - pageNumW;
    pageOps.push(
      `BT /F1 7.5 Tf 1 0 0 1 ${num(txRight)} ${num(baseline)} Tm (${escapePdfText(pageNumText)}) Tj ET`
    );
  });

  // ---------- assemble pdf ----------
  const objects: string[] = [];

  const f1 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>");
  const f2 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>");
  const f3 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding>>");

  const pageCount = pages.length;

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
    objects.push(
      `<</Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Resources <</Font <</F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R>>>> /Contents ${contentIds[i]} 0 R>>`
    );
    pageIds.push(id);
  });

  const catalogId = objects.length + 1;
  objects.push(
    `<</Type /Pages /Count ${pageCount} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}]>>`
  );

  const rootId = objects.length + 1;
  objects.push(`<</Type /Catalog /Pages ${catalogId} 0 R>>`);

  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [0];
  objects.forEach((body, idx) => {
    offsets[idx + 1] = pdf.length;
    pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1} /Root ${rootId} 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return new Blob([bytes], { type: "application/pdf" });
}

/* -------------------------------- downloader -------------------------------- */

export async function downloadExport(options: DownloadOptions): Promise<void> {
  const { format, title, subtitle, columns, rows, filename, kop, orientation } = options;
  const input: ExportInput = { title, subtitle, columns, rows, filename, kop, orientation };
  const base = slugify(filename || title);

  let blob: Blob;
  let ext: string;

  if (format === "excel") {
    blob = await buildExcelBlob(input);
    ext = "xlsx";
  } else if (format === "doc") {
    blob = buildDocBlob(input);
    ext = "doc";
  } else {
    blob = buildPdfBlob(input);
    ext = "pdf";
  }

  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${base}-${date}.${ext}`);
}
