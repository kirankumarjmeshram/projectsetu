import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Header,
  PageBreak,
  PageOrientation,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type {
  DprReportModel,
  RenderedReportArtifact,
  ReportTable,
} from "../contracts";

const BLUE = "17365D";
const LIGHT = "EAF0F6";

type DocxChild = Paragraph | Table | TableOfContents;

interface DocxSectionContent {
  orientation: "PORTRAIT" | "LANDSCAPE";
  children: DocxChild[];
}

function reportTable(table: ReportTable): Table {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
  const cell = (text: string, header = false) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      shading: header ? { type: ShadingType.CLEAR, fill: BLUE } : undefined,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: header,
              color: header ? "FFFFFF" : "172033",
              size: 17,
            }),
          ],
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: table.columns.map((value) => cell(value, true)),
      }),
      ...table.rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: row.map((value) => cell(value.displayValue)),
          }),
      ),
    ],
  });
}

export async function renderDocx(
  model: DprReportModel,
): Promise<RenderedReportArtifact> {
  const documentSections: DocxSectionContent[] = [
    {
      orientation: "PORTRAIT",
      children: [
        new Paragraph({
          spacing: { before: 2600 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "DETAILED PROJECT REPORT",
              bold: true,
              color: BLUE,
              size: 52,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 360 },
          children: [
            new TextRun({
              text: model.project.project.name,
              bold: true,
              color: "334155",
              size: 36,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 900 },
          children: [
            new TextRun({
              text: `Prepared for ${model.project.applicant.name}\nReport Version ${model.identity.reportVersion}\nGenerated ${model.identity.generatedAt.slice(0, 10)}`,
              size: 22,
              color: "475569",
            }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: "Table of Contents",
          heading: HeadingLevel.HEADING_1,
        }),
        new TableOfContents("Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
      ],
    },
  ];
  for (const section of model.sections.filter(
    (item) => !["cover", "table-of-contents"].includes(item.id),
  )) {
    const orientation = section.tables.some(
      (table) => table.columns.length >= 8,
    )
      ? "LANDSCAPE"
      : "PORTRAIT";
    const previousSection = documentSections.at(-1)!;
    const startsNewDocumentSection =
      previousSection.orientation !== orientation;
    const children: DocxChild[] = startsNewDocumentSection
      ? []
      : previousSection.children;
    if (startsNewDocumentSection)
      documentSections.push({ orientation, children });
    if (
      !startsNewDocumentSection &&
      (section.tables.length > 0 ||
        ["executive-summary", "risks-mitigation", "conclusion"].includes(
          section.id,
        ))
    )
      children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        text: `${section.order}. ${section.title}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );
    if (section.narrative)
      children.push(
        new Paragraph({
          text: section.narrative.text,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 220, line: 300 },
        }),
      );
    for (const table of section.tables) {
      children.push(
        new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_2 }),
      );
      children.push(reportTable(table));
      for (const note of table.notes ?? [])
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: note,
                italics: true,
                color: "475569",
                size: 17,
              }),
            ],
            spacing: { before: 80, after: 140 },
          }),
        );
    }
  }
  const children = documentSections.at(-1)!.children;
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      text: "Important Disclaimer",
      heading: HeadingLevel.HEADING_1,
    }),
  );
  model.disclaimer.forEach((line) =>
    children.push(new Paragraph({ text: line, bullet: { level: 0 } })),
  );

  const document = new Document({
    creator: "ProjectSetu",
    title: model.title,
    description: "Professional bankable detailed project report",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 20, color: "172033" },
          paragraph: { spacing: { after: 120 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 30, bold: true, color: BLUE },
          paragraph: { spacing: { before: 260, after: 160 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 23, bold: true, color: BLUE },
          paragraph: {
            spacing: { before: 180, after: 100 },
            keepNext: true,
            shading: { type: ShadingType.CLEAR, fill: LIGHT },
          },
        },
      ],
    },
    sections: documentSections.map(({ orientation, children }) => {
      const landscape = orientation === "LANDSCAPE";
      return {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "ProjectSetu · Detailed Project Report",
                    color: "64748B",
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "64748B" }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      };
    }),
  });
  return {
    format: "DOCX",
    filename: `${model.filenameStem}.docx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    content: await Packer.toBuffer(document),
  };
}
