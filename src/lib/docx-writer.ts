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
  type KopLogos,
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

function logoExtension(logo: LogoImage): "png" | "jpeg" {
  return logo.mimeType === "image/png" || logo.dataUrl.startsWith("data:image/png") ? "png" : "jpeg";
}

function logoDrawing(logo: LogoImage, relId: string, maxSize = 72, name = "Logo"): string {
  const scale = Math.min(1, maxSize / Math.max(logo.width, logo.height));
  const width = Math.max(1, Math.round(logo.width * scale));
  const height = Math.max(1, Math.round(logo.height * scale));
  const emuW = Math.round(width * 9525);
  const emuH = Math.round(height * 9525);
  const docprId = Math.floor(Math.random() * 10000) + 10;
  return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emuW}" cy="${emuH}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docprId}" name="${escapeXml(name)}" descr="${escapeXml(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docprId}" name="${escapeXml(name)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}

function headerBlock(
  kopLines: KopLine[],
  width: number,
  logos?: KopLogos,
  rels?: { left?: string; right?: string }
): string {
  const lines = kopLines
    .map((line) =>
      textParagraph(line.text, {
        align: "center",
        size: line.size,
        bold: line.bold,
        color: line.color === "navy" ? DOCUMENT_PALETTE.navy : DOCUMENT_PALETTE.text,
        after: 20,
      })
    )
    .join("");
  const sideW = 1500;
  const centerW = width - sideW * 2;
  const left = `<w:tc><w:tcPr><w:tcW w:w="${sideW}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tcBorders></w:tcPr>${paragraph(logos?.left && rels?.left ? logoDrawing(logos.left, rels.left, 74, "Logo OSIS") : "", { align: "center", after: 0 })}</w:tc>`;
  const center = `<w:tc><w:tcPr><w:tcW w:w="${centerW}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tcBorders></w:tcPr>${lines}</w:tc>`;
  const right = `<w:tc><w:tcPr><w:tcW w:w="${sideW}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tcBorders></w:tcPr>${paragraph(logos?.right && rels?.right ? logoDrawing(logos.right, rels.right, 74, "Logo Tamir") : "", { align: "center", after: 0 })}</w:tc>`;
  const borderColor = "000000";
  const kopTable = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="18" w:space="8" w:color="${borderColor}"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${sideW}"/><w:gridCol w:w="${centerW}"/><w:gridCol w:w="${sideW}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${left}${center}${right}</w:tr></w:tbl>`;
  return `${kopTable}${textParagraph("", { after: 160 })}`;
}

function approvalBlock(approval: ApprovalSpec, width: number): string {
  const signatories = approval.signatories;
  const count = signatories.length;
  const noBorder = "<w:tcBorders><w:top w:val=\"nil\"/><w:left w:val=\"nil\"/><w:bottom w:val=\"nil\"/><w:right w:val=\"nil\"/><w:insideH w:val=\"nil\"/><w:insideV w:val=\"nil\"/></w:tcBorders>";
  const signatureCell = (label: string, name: string, cellWidth: number) =>
    `<w:tc><w:tcPr><w:tcW w:w="${Math.round(cellWidth)}" w:type="dxa"/>${noBorder}<w:vAlign w:val="top"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(
      `${run(label, { size: 9, bold: true, color: DOCUMENT_PALETTE.navy })}${run("\n\n\n\n", { size: 9 })}${run("........................................", { size: 9, color: DOCUMENT_PALETTE.muted })}${name ? run(`\n${name}`, { size: 9.5, bold: true }) : ""}`,
      { align: "left" }
    )}</w:tc>`;

  const leftW = Math.round(width * 0.65);
  const rightW = width - leftW;
  const colWidth = Math.floor(width / Math.max(count, 1));
  const widths =
    count === 1
      ? [leftW, rightW]
      : Array.from({ length: count }, (_, i) =>
          i === count - 1 ? width - colWidth * (count - 1) : colWidth
        );
  const cells =
    count === 1
      ? `<w:tc><w:tcPr><w:tcW w:w="${leftW}" w:type="dxa"/>${noBorder}</w:tcPr>${paragraph("")}</w:tc>${signatureCell(signatories[0].label, signatories[0].name.trim(), rightW)}`
      : signatories
          .map((s, i) =>
            signatureCell(s.label, s.name.trim(), i === count - 1 ? widths[i] : colWidth)
          )
          .join("");
  const borderlessTable = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join("")}</w:tblGrid><w:tr>${cells}</w:tr></w:tbl>`;

  return `${textParagraph(approval.heading ?? "PENGESAHAN", {
    bold: true,
    size: 10,
    color: DOCUMENT_PALETTE.navy,
    before: 360,
    after: 100,
  })}${borderlessTable}`;
}

function footerXml(identity: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="${DOCUMENT_PALETTE.border.replace("#", "")}"/></w:pBdr><w:jc w:val="left"/></w:pPr>${run(identity, { size: 8, color: DOCUMENT_PALETTE.muted })}</w:p>
<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:fldSimple w:instr=" PAGE ">${run("1", { size: 8, color: DOCUMENT_PALETTE.muted })}</w:fldSimple></w:p>
</w:ftr>`;
}

export async function buildDocxBlob(
  input: ExportInput,
  options: {
    kopLines: KopLine[];
    metaRows: [string, string][];
    summary: SummaryItem[];
    approval: ApprovalSpec;
    periodLabel: string;
    documentType: string;
    kopLogos?: KopLogos;
    footerIdentity?: string;
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

  const logos = options.kopLogos ?? (input.logo ? { left: input.logo } : undefined);
  const rels = {
    left: logos?.left ? "rId4" : undefined,
    right: logos?.right ? "rId5" : undefined,
  };
  const body: string[] = [];
  body.push(headerBlock(options.kopLines, contentW, logos, rels));
  body.push(table(metaRows, [contentW * 0.28, contentW * 0.72]));
  body.push(textParagraph("DATA LAPORAN", { bold: true, size: 10, color: DOCUMENT_PALETTE.navy, before: 200, after: 80 }));
  body.push(
    table(
      [`${headerCells}`, ...(input.rows.length ? dataRows : [emptyRow])],
      widths,
      1
    )
  );
  if (summaryRows.length > 0) {
    body.push(textParagraph("RINGKASAN", { bold: true, size: 10, color: DOCUMENT_PALETTE.navy, before: 200, after: 80 }));
    body.push(table(summaryRows, [contentW * 0.6, contentW * 0.4]));
  }
  body.push(approvalBlock(options.approval, contentW));

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${body.join("")}
<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body></w:document>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${DOCUMENT_PALETTE.text.replace("#", "")}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

  const relEntries = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
  ];
  if (logos?.left) relEntries.push(`<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-left.${logoExtension(logos.left)}"/>`);
  if (logos?.right) relEntries.push(`<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-right.${logoExtension(logos.right)}"/>`);
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relEntries.join("\n")}
</Relationships>`;

  const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", packageRels);
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", styles);
  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`);
  zip.file("word/footer1.xml", footerXml(options.footerIdentity ?? `IP4A Pondok Pesantren Al-Ittihad`));
  zip.file("word/_rels/document.xml.rels", relsXml);
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(input.title)}</dc:title><dc:subject>${escapeXml(options.documentType)}</dc:subject></cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>APKOSIS</Application></Properties>`
  );
  if (logos?.left) {
    zip.file(
      `word/media/logo-left.${logoExtension(logos.left)}`,
      logos.left.dataUrl.replace(/^data:image\/[^;]+;base64,/, ""),
      { base64: true }
    );
  }
  if (logos?.right) {
    zip.file(
      `word/media/logo-right.${logoExtension(logos.right)}`,
      logos.right.dataUrl.replace(/^data:image\/[^;]+;base64,/, ""),
      { base64: true }
    );
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
