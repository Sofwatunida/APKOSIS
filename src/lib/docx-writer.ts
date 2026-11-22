/**
 * Penulis DOCX minimal berbasis OOXML (bukan HTML disamarkan sebagai .doc).
 * Menghasilkan tabel asli Microsoft Word yang masih dapat diedit, kop organisasi,
 * footer identitas, dan field nomor halaman PAGE / NUMPAGES.
 */

import JSZip from "jszip";
import {
  DOCUMENT_PALETTE,
  escapeXml,
  type ApprovalSpec,
  type ExportColumn,
  type ExportInput,
  type KopLine,
  type LogoImage,
  type SummaryItem,
} from "./export-document";

const TWIP_A4_W = 11906;
const TWIP_A4_H = 16838;
const MARGIN = 1134;

function run(
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    font?: string;
  } = {}
): string {
  const size = Math.round((opts.size ?? 10) * 2);
  const rpr = [
    `<w:rFonts w:ascii="${opts.font ?? "Aptos"}" w:hAnsi="${opts.font ?? "Aptos"}" w:cs="Arial"/>`,
    opts.bold ? "<w:b/>" : "",
    opts.italic ? "<w:i/>" : "",
    `<w:color w:val="${(opts.color ?? DOCUMENT_PALETTE.text).replace("#", "")}"/>`,
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
  ].join("");
  const parts = text.split("\n").map((line, i) =>
    `${i > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`
  );
  return `<w:r><w:rPr>${rpr}</w:rPr>${parts.join("")}</w:r>`;
}

function paragraph(
  content: string,
  opts: {
    align?: "left" | "center" | "right";
    before?: number;
    after?: number;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    borderBottom?: boolean;
  } = {}
): string {
  const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : "";
  const spacing = `<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 80}"/>`;
  const border = opts.borderBottom
    ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${DOCUMENT_PALETTE.navy.replace("#", "")}"/></w:pBdr>`
    : "";
  return `<w:p><w:pPr>${jc}${spacing}${border}</w:pPr>${content}</w:p>`;
}

function textParagraph(text: string, opts: Parameters<typeof paragraph>[1] = {}): string {
  return paragraph(
    run(text, {
      size: opts.size,
      bold: opts.bold,
      italic: opts.italic,
      color: opts.color,
    }),
    opts
  );
}

function cell(
  content: string,
  width: number,
  opts: {
    fill?: string;
    align?: "left" | "center" | "right";
    bold?: boolean;
    size?: number;
    color?: string;
    valign?: "top" | "center";
  } = {}
): string {
  const shd = opts.fill
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill.replace("#", "")}"/>`
    : "";
  const tcpr = `<w:tcPr><w:tcW w:w="${Math.round(width)}" w:type="dxa"/>${shd}<w:vAlign w:val="${opts.valign ?? "center"}"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>`;
  return `<w:tc>${tcpr}${paragraph(content, { align: opts.align })}</w:tc>`;
}

function table(rows: string[], widths: number[], headerRows = 0): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join("");
  const body = rows
    .map((row, i) => {
      const header = i < headerRows;
      const pr = `<w:trPr>${header ? "<w:tblHeader/>" : ""}<w:cantSplit/></w:trPr>`;
      return `<w:tr>${pr}${row}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/><w:left w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/><w:bottom w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/><w:right w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/><w:insideH w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/><w:insideV w:val="single" w:sz="4" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/[•▪◦●]/g, "-");
}

function logoDrawing(logo: LogoImage, id: string): string {
  const width = Math.min(logo.width, 90);
  const height = Math.min(logo.height, 90);
  const emuW = Math.round(width * 9525);
  const emuH = Math.round(height * 9525);
  const docprId = "10";
  return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emuW}" cy="${emuH}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docprId}" name="Logo Sekolah" descr="Logo sekolah yang dikonfigurasi administrator"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docprId}" name="logo.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

function headerBlock(input: ExportInput, kopLines: KopLine[], width: number, logoRelId?: string): string {
  const lines = kopLines
    .map((line) =>
      textParagraph(line.text, {
        align: "center",
        size: line.size,
        bold: line.bold,
        color: line.color === "navy" ? DOCUMENT_PALETTE.navy : DOCUMENT_PALETTE.text,
        after: 10,
      })
    )
    .join("");
  if (input.logo && logoRelId) {
    const logoCell = `<w:tc><w:tcPr><w:tcW w:w="1400" w:type="dxa"/></w:tcPr>${paragraph(logoDrawing(input.logo, logoRelId), { align: "center" })}</w:tc>`;
    return table([`${logoCell}${cell(lines, width - 1400)}`], [1400, width - 1400]);
  }
  return paragraph(lines, { borderBottom: true, after: 160 });
}

function approvalBlock(approval: ApprovalSpec, width: number): string {
  const count = approval.signatories.length;
  const colWidth = Math.floor(width / count);
  const cells = approval.signatories
    .map((s, i) =>
      cell(
        `${run(s.label, { size: 9, bold: true, color: DOCUMENT_PALETTE.navy })}${run("\n\n\n\n", { size: 9 })}${run(s.name, { size: 9.5, bold: true })}${run("\n" + "".padStart(s.name.length, " "), { size: 9 })}`,
        i === count - 1 ? width - colWidth * (count - 1) : colWidth,
        { align: "left", valign: "top" }
      )
    )
    .join("");
  return `${textParagraph(approval.heading ?? "PENGESAHAN", {
    bold: true,
    size: 10,
    color: DOCUMENT_PALETTE.navy,
    before: 220,
    after: 100,
  })}${table([cells], Array.from({ length: count }, (_, i) =>
    i === count - 1 ? width - colWidth * (count - 1) : colWidth
  ))}`;
}

function footerXml(schoolName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/></w:pBdr><w:jc w:val="left"/></w:pPr>${run(`OSIS ${schoolName}`, { size: 8, color: DOCUMENT_PALETTE.muted })}</w:p>
<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run("Halaman ", { size: 8, color: DOCUMENT_PALETTE.muted })}<w:fldSimple w:instr=" PAGE ">${run("1", { size: 8, color: DOCUMENT_PALETTE.muted })}</w:fldSimple>${run(" dari ", { size: 8, color: DOCUMENT_PALETTE.muted })}<w:fldSimple w:instr=" NUMPAGES ">${run("1", { size: 8, color: DOCUMENT_PALETTE.muted })}</w:fldSimple></w:p>
</w:ftr>`;
}

export async function buildDocxBlob(
  input: ExportInput,
  options: {
    kopLines: KopLine[];
    metaRows: [string, string][];
    summary: SummaryItem[];
    notes: string[];
    approval: ApprovalSpec;
    periodLabel: string;
    documentType: string;
  }
): Promise<Blob> {
  const JSZipCtor = (JSZip as unknown as { default?: typeof JSZip }).default ?? JSZip;
  const zip = new JSZipCtor();
  const landscape = input.orientation === "landscape" ||
    (input.orientation !== "portrait" && input.columns.length >= 6);
  const pageW = landscape ? TWIP_A4_H : TWIP_A4_W;
  const pageH = landscape ? TWIP_A4_W : TWIP_A4_H;
  const contentW = pageW - MARGIN * 2;
  const schoolName = input.kop?.namaSekolah?.trim() || "[NAMA SEKOLAH]";

  const ratios = input.columns.map((c) => c.width ?? 1);
  const sumRatios = ratios.reduce((a, b) => a + b, 0) || 1;
  const widths = ratios.map((r) => (r / sumRatios) * contentW);

  const headerCells = input.columns
    .map((c, i) =>
      cell(
        run(c.header, { size: 8.5, bold: true, color: DOCUMENT_PALETTE.white }),
        widths[i],
        { align: "center", fill: DOCUMENT_PALETTE.navy }
      )
    )
    .join("");

  const dataRows = input.rows.map((r, idx) => {
    const isTotal = Boolean(r.__total);
    const isEven = idx % 2 === 1;
    const fill = isTotal ? DOCUMENT_PALETTE.lightBlue : isEven ? "#F7FAFD" : undefined;
    const alignOf = (c: ExportColumn) =>
      c.align === "right" ? "right" : c.align === "center" ? "center" : "left";
    return input.columns
      .map((c, i) =>
        cell(
          run(cellText(r[c.key]), {
            size: 8.5,
            bold: isTotal,
            color: isTotal ? DOCUMENT_PALETTE.navy : DOCUMENT_PALETTE.text,
          }),
          widths[i],
          { fill, align: alignOf(c) }
        )
      )
      .join("");
  });

  const emptyRow = cell(
    run("Belum ada data yang tercatat untuk laporan / periode ini.", {
      size: 9,
      italic: true,
      color: DOCUMENT_PALETTE.muted,
    }),
    contentW
  );

  const metaRows = options.metaRows.map(([label, value]) =>
    `${cell(run(label, { size: 8.5, bold: true, color: DOCUMENT_PALETTE.navy }), contentW * 0.28, {
      fill: DOCUMENT_PALETTE.lightBlue,
    })}${cell(run(value, { size: 8.5 }), contentW * 0.72)}`
  );

  const summaryRows = options.summary.map((item) =>
    `${cell(run(item.label, { size: 8.5, bold: true, color: DOCUMENT_PALETTE.navy }), contentW * 0.6, {
      fill: DOCUMENT_PALETTE.lightBlue,
    })}${cell(run(item.value, { size: 8.5, bold: true, color: DOCUMENT_PALETTE.text }), contentW * 0.4)}`
  );

  const body: string[] = [];
  body.push(headerBlock(input, options.kopLines, contentW, input.logo ? "rId4" : undefined));
  body.push(
    textParagraph(input.title, {
      align: "center",
      bold: true,
      size: 15,
      color: DOCUMENT_PALETTE.navy,
      before: 80,
      after: 60,
    })
  );
  body.push(
    textParagraph(options.documentType, {
      align: "center",
      size: 9,
      bold: true,
      color: DOCUMENT_PALETTE.blue,
      after: 140,
    })
  );
  body.push(table(metaRows, [contentW * 0.28, contentW * 0.72]));
  body.push(textParagraph("DATA LAPORAN", { bold: true, size: 10, color: DOCUMENT_PALETTE.navy, before: 200, after: 80 }));
  body.push(
    table(
      [`${headerCells}`, ...(input.rows.length ? dataRows : [emptyRow])],
      widths,
      1
    )
  );
  body.push(textParagraph("RINGKASAN", { bold: true, size: 10, color: DOCUMENT_PALETTE.navy, before: 200, after: 80 }));
  body.push(table(summaryRows, [contentW * 0.6, contentW * 0.4]));
  body.push(textParagraph("KETERANGAN", { bold: true, size: 10, color: DOCUMENT_PALETTE.navy, before: 200, after: 80 }));
  options.notes.forEach((note, i) =>
    body.push(textParagraph(`${i + 1}. ${note}`, { size: 9, after: 40 }))
  );
  body.push(approvalBlock(options.approval, contentW));

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body.join("")}
<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body></w:document>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${DOCUMENT_PALETTE.text.replace("#", "")}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
${input.logo ? '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/>' : ""}
</Relationships>`;

  const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", packageRels);
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", styles);
  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`);
  zip.file("word/footer1.xml", footerXml(schoolName));
  zip.file("word/_rels/document.xml.rels", rels);
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(input.title)}</dc:title><dc:subject>${escapeXml(options.documentType)}</dc:subject></cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>APKOSIS</Application></Properties>`
  );
  if (input.logo) {
    zip.file(
      "word/media/image1.jpeg",
      input.logo.dataUrl.replace(/^data:image\/[^;]+;base64,/, ""),
      { base64: true }
    );
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
