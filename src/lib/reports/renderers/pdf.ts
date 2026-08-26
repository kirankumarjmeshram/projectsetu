import PDFDocument from "pdfkit";

import type {
  DprReportModel,
  RenderedReportArtifact,
  ReportTable,
} from "../contracts";

const PAGE = { width: 595.28, height: 841.89, margin: 48 };

function pdfText(value: string): string {
  return value.replaceAll("₹", "Rs. ");
}

function renderTable(doc: PDFKit.PDFDocument, table: ReportTable): void {
  const pageWidth = doc.page.width - PAGE.margin * 2;
  const width = pageWidth / table.columns.length;
  const drawRow = (values: readonly string[], header = false) => {
    const height = Math.max(
      24,
      ...values.map(
        (value) => doc.heightOfString(pdfText(value), { width: width - 8 }) + 8,
      ),
    );
    if (doc.y + height > doc.page.height - 60) {
      doc.addPage({
        size: "A4",
        layout: doc.page.width > doc.page.height ? "landscape" : "portrait",
      });
      drawRow(table.columns, true);
    }
    const y = doc.y;
    values.forEach((value, index) => {
      doc
        .save()
        .rect(PAGE.margin + index * width, y, width, height)
        .fillAndStroke(header ? "#17365D" : "#FFFFFF", "#CBD5E1")
        .restore();
      doc
        .fillColor(header ? "#FFFFFF" : "#172033")
        .font(header ? "Helvetica-Bold" : "Helvetica")
        .fontSize(header ? 8 : 7.5)
        .text(pdfText(value), PAGE.margin + index * width + 4, y + 4, {
          width: width - 8,
          height: height - 6,
        });
    });
    doc.x = PAGE.margin;
    doc.y = y + height;
  };
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#17365D")
    .text(table.title)
    .moveDown(0.35);
  drawRow(table.columns, true);
  table.rows.forEach((row) => drawRow(row.map((cell) => cell.displayValue)));
  for (const note of table.notes ?? [])
    doc
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#475569")
      .text(note, { width: pageWidth });
  doc.moveDown(0.8);
  doc.x = PAGE.margin;
}

export async function renderPdf(
  model: DprReportModel,
): Promise<RenderedReportArtifact> {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: PAGE.margin,
      right: PAGE.margin,
      bottom: 54,
      left: PAGE.margin,
    },
    bufferPages: true,
    info: { Title: model.title, Author: "ProjectSetu" },
    compress: false,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, PAGE.width, PAGE.height).fill("#F8FAFC");
  doc.rect(0, 0, 16, PAGE.height).fill("#17365D");
  doc
    .fillColor("#17365D")
    .font("Helvetica-Bold")
    .fontSize(28)
    .text("DETAILED PROJECT REPORT", 62, 180, { width: 470 });
  doc
    .moveDown(0.8)
    .fontSize(20)
    .fillColor("#334155")
    .text(model.project.project.name);
  doc
    .moveDown(1.5)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#475569")
    .text(`Prepared for ${model.project.applicant.name}`)
    .text(`Report Version ${model.identity.reportVersion}`)
    .text(`Generated ${model.identity.generatedAt.slice(0, 10)}`);
  doc
    .fontSize(9)
    .fillColor("#64748B")
    .text("Professional bankable project report", 62, 720);

  doc.addPage();
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#17365D")
    .text("Table of Contents")
    .moveDown();
  model.sections
    .filter((section) => !["cover", "table-of-contents"].includes(section.id))
    .forEach((section) =>
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#172033")
        .text(`${section.order}. ${section.title}`, { continued: false }),
    );

  for (const section of model.sections.filter(
    (item) => !["cover", "table-of-contents"].includes(item.id),
  )) {
    if (section.tables.length > 0 || doc.y > 650)
      doc.addPage({
        size: "A4",
        layout: section.tables.some((table) => table.columns.length >= 8)
          ? "landscape"
          : "portrait",
      });
    else doc.moveDown(1.5);
    doc.x = PAGE.margin;
    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#17365D")
      .text(`${section.order}. ${section.title}`)
      .moveDown(0.5);
    if (section.narrative)
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#263548")
        .text(pdfText(section.narrative.text), { align: "justify", lineGap: 2 })
        .moveDown();
    section.tables.forEach((item) => renderTable(doc, item));
  }
  doc.addPage();
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#17365D")
    .text("Important Disclaimer")
    .moveDown();
  model.disclaimer.forEach((line) =>
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#334155")
      .text(`• ${line}`)
      .moveDown(0.4),
  );

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#64748B")
      .text(
        "ProjectSetu · Detailed Project Report",
        PAGE.margin,
        doc.page.height - 36,
        { width: 350, lineBreak: false },
      )
      .text(
        `Page ${index + 1} of ${range.count}`,
        doc.page.width - 140,
        doc.page.height - 36,
        { width: 92, align: "right", lineBreak: false },
      );
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return {
    format: "PDF",
    filename: `${model.filenameStem}.pdf`,
    mimeType: "application/pdf",
    content: await complete,
  };
}
