"use client";

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
}

export type ExportFormat = "pdf" | "doc" | "excel";

interface DownloadOptions extends ExportInput {
  format: ExportFormat;
}

/* ------------------------------ shared values ------------------------------ */

const BRAND_HEX = "#4f46e5";
const BRAND_ARGB = "FF4F46E5";
const HEADER_BORDER_HEX = "#4338ca";
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
  return value.replace(/[•▪◦●]/g, "-").replace(/\r\n?/g, "\n").replace(/\t/g, " ");
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
    width: Math.min(Math.max(Math.round(ratios[i] * 42), 12), 52),
  }));

  const bodyBorder = {
    top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
  };

  const headerBorder = {
    top: { style: "thin" as const, color: { argb: "FF4338CA" } },
    left: { style: "thin" as const, color: { argb: "FF4338CA" } },
    bottom: { style: "thin" as const, color: { argb: "FF4338CA" } },
    right: { style: "thin" as const, color: { argb: "FF4338CA" } },
  };

  const titleRow = ws.addRow([input.title]);
  ws.mergeCells(1, 1, 1, input.columns.length);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 26;

  let headerIndex = 2;
  if (input.subtitle) {
    const subRow = ws.addRow([input.subtitle]);
    ws.mergeCells(2, 1, 2, input.columns.length);
    subRow.getCell(1).value = input.subtitle;
    subRow.getCell(1).font = { size: 10, italic: true, color: { argb: "FF64748B" } };
    subRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 16;
    headerIndex = 3;
  }

  const headerRow = ws.addRow(input.columns.map((c) => c.header));
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = headerBorder;
  });

  const keys = input.columns.map((c) => c.key);
  input.rows.forEach((r) => {
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
      const width = ws.columns[colIdx]?.width ?? 20;
      const text = String(cell.value ?? "");
      let lines = 1;
      text.split("\n").forEach((seg) => {
        lines += Math.ceil(seg.length / Math.max(width * 1.2, 8));
      });
      maxLines = Math.max(maxLines, lines);
    });
    row.height = Math.max(18, maxLines * 15 + 6);
  });

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

  const bodyRows = input.rows
    .map((r) => {
      const tds = input.columns
        .map((c, i) => {
          const html = cellValue(r, c.key)
            .split("\n")
            .map((line) => escapeHtml(line))
            .join("<br/>");
          return `<td width="${pct[i]}%" style="border:1pt solid ${BODY_BORDER_HEX};padding:5pt 8pt;text-align:${cellAlign(
            c
          )};vertical-align:top;">${html ? html : "&nbsp;"}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const subtitleHtml = input.subtitle
    ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>`
    : "";

  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 1.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4pt; }
  .subtitle { text-align: center; font-size: 10pt; color: #64748b; margin: 0 0 2pt; }
  .meta { text-align: center; font-size: 8.5pt; color: #94a3b8; margin: 0 0 12pt; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; mso-table-layout-alt: fixed; }
  td, th { mso-padding-alt: 0in 0in 0in 0in; }
</style>
</head>
<body>
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

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 36;
const BOTTOM = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

type RGB = [number, number, number];

const COLOR_TEXT: RGB = [0.13, 0.14, 0.16];
const COLOR_MUTED: RGB = [0.45, 0.47, 0.51];
const COLOR_HEADER_BG: RGB = [0.31, 0.27, 0.9]; // #4f46e5 (sama dengan DOC/Excel)
const COLOR_BORDER: RGB = [0.796, 0.835, 0.882]; // #cbd5e1
const COLOR_HEADER_BORDER: RGB = [0.26, 0.22, 0.79]; // #4338ca

function num(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "");
}

function escapePdfText(s: string): string {
  let out = "";
  for (const ch of s) {
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
  return out;
}

function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c === 32) w += 0.28;
    else if (c >= 65 && c <= 90) w += 0.62;
    else if (c >= 48 && c <= 57) w += 0.5;
    else if ("ilj.,'`:;|!".includes(ch)) w += 0.3;
    else if ("mwMW@%@".includes(ch)) w += 0.62;
    else if (c > 127) w += 0.55;
    else w += 0.5;
  }
  return w * size;
}

function hardSplit(word: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && textWidth(cur + ch, size) > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [word];
}

function wrapSegment(str: string, size: number, maxWidth: number): string[] {
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
    while (piece && textWidth(line ? `${line} ${piece}` : piece, size) > maxWidth) {
      if (!line) {
        const split = hardSplit(piece, size, maxWidth);
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

// Membungkus teks, termasuk menghormati baris baru (untuk list)
function wrapText(str: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  str.split("\n").forEach((seg) => {
    wrapSegment(seg, size, maxWidth).forEach((l) => out.push(l));
  });
  return out.length > 0 ? out : [""];
}

function buildPdfBlob(input: ExportInput): Blob {
  const rawWidths = input.columns.map((c) => c.width ?? 1);
  const sum = rawWidths.reduce((a, b) => a + b, 0) || 1;
  const widths = rawWidths.map((w) => (w / sum) * CONTENT_W);

  const pages: string[][] = [];
  let ops: string[] = [];
  let topY = PAGE_H - MARGIN;

  function beginPage() {
    ops = [];
    topY = PAGE_H - MARGIN;
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
    align: "left" | "center" | "right" = "left"
  ) {
    const baseline = PAGE_H - yTop - size * 0.82;
    const w = textWidth(text, size);
    let tx = x;
    if (align === "center") tx = x + (maxWidth - w) / 2;
    else if (align === "right") tx = x + maxWidth - w;
    const font = bold ? "F2" : "F1";
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

  function strokeRect(x: number, yTop: number, w: number, h: number, color: RGB = COLOR_BORDER) {
    const y = PAGE_H - yTop - h;
    ops.push("0.6 w RG");
    ops.push(`${num(color[0])} ${num(color[1])} ${num(color[2])} RG`);
    ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re S`);
  }

  const HEADER_H = 18;

  function drawHeaderRow() {
    fillRect(MARGIN, topY, CONTENT_W, HEADER_H, COLOR_HEADER_BG);
    input.columns.forEach((c, i) => {
      const x = MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0);
      drawText(c.header, 9, true, x + 4, topY + 2, [1, 1, 1], widths[i] - 7, "center");
    });
    strokeRect(MARGIN, topY, CONTENT_W, HEADER_H, COLOR_HEADER_BORDER);
    topY += HEADER_H;
  }

  drawText(input.title, 16, true, MARGIN, topY, COLOR_TEXT, CONTENT_W, "center");
  topY += 24;
  if (input.subtitle) {
    drawText(input.subtitle, 11, false, MARGIN, topY, COLOR_MUTED, CONTENT_W, "center");
    topY += 16;
  }
  drawText(`Dicetak pada ${todayLabel()}`, 9, false, MARGIN, topY, COLOR_MUTED, CONTENT_W, "center");
  topY += 20;

  drawHeaderRow();

  const ROW_PAD_X = 4;
  const ROW_PAD_TOP = 4;
  const ROW_LINE_H = 10.5;

  function ensureSpace(rowHeight: number) {
    if (topY + rowHeight <= PAGE_H - BOTTOM) return;
    beginPage();
    drawHeaderRow();
  }

  function rowValue(r: Record<string, unknown>, c: ExportColumn): string {
    return cellValue(r, c.key);
  }

  input.rows.forEach((r) => {
    const wrapped = input.columns.map((c) =>
      wrapText(rowValue(r, c), 9, widths[input.columns.indexOf(c)] - ROW_PAD_X * 2)
    );
    const lineCount = Math.max(...wrapped.map((l) => l.length), 1);
    const rowHeight = lineCount * ROW_LINE_H + ROW_PAD_TOP + 3;

    ensureSpace(rowHeight);

    input.columns.forEach((c, i) => {
      const x = MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0);
      strokeRect(x, topY, widths[i], rowHeight);
      const lines = wrapped[i];
      lines.forEach((line, j) => {
        drawText(
          line,
          9,
          false,
          x + ROW_PAD_X,
          topY + ROW_PAD_TOP + j * ROW_LINE_H,
          COLOR_TEXT,
          widths[i] - ROW_PAD_X * 2,
          cellAlign(c)
        );
      });
    });

    topY += rowHeight;
  });

  // ---------- assemble pdf ----------
  const objects: string[] = [];

  const f1 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>");
  const f2 = objects.length + 1;
  objects.push("<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>>");

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
      `<</Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] /Resources <</Font <</F1 ${f1} 0 R /F2 ${f2} 0 R>>>> /Contents ${contentIds[i]} 0 R>>`
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
  const { format, title, subtitle, columns, rows, filename } = options;
  const input: ExportInput = { title, subtitle, columns, rows, filename };
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