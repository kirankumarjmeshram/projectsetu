import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { professionalFixture } from "../src/lib/application/orchestrator/testing/professional-fixture";
import { orchestrateProjectCalculation } from "../src/lib/application/orchestrator/calculation-orchestrator";
import { buildDprReportModel } from "../src/lib/reports/builder";
import { validateDprReport } from "../src/lib/reports/validation";
import {
  renderPdf,
  renderDocx,
  renderExcel,
} from "../src/lib/reports/renderers";

const output = resolve("tmp/professional-qa");
await mkdir(output, { recursive: true });
for (const scheme of [false, true]) {
  const project = professionalFixture(scheme);
  const calculation = orchestrateProjectCalculation(project, "2026-09-09");
  const model = await buildDprReportModel({
    project,
    calculation,
    identity: {
      reportId: scheme ? "case-b" : "case-a",
      reportVersion: 1,
      projectId: project.project.id,
      inputSnapshotId: "fixture-input",
      calculationRunId: "fixture-run",
      fundingSnapshotId: scheme ? "fixture-funding" : undefined,
      templateVersion: "BASE_BANKABLE_DPR/1.0",
      contentSchemaVersion: 1,
      generatedAt: "2026-09-09T00:00:00.000Z",
      language: "en",
    },
  });
  const validation = validateDprReport(model);
  if (!validation.validForExport) throw new Error(JSON.stringify(validation));
  const stem = scheme ? "case-b" : "case-a";
  await writeFile(
    resolve(output, `${stem}.json`),
    JSON.stringify({ project, calculation, model, validation }, null, 2),
  );
  for (const render of [renderPdf, renderDocx, renderExcel]) {
    const artifact = await render(model);
    await writeFile(
      resolve(output, `${stem}.${artifact.format.toLowerCase()}`),
      artifact.content,
    );
    console.log(`${stem} ${artifact.format}: ${artifact.content.length} bytes`);
  }
}
