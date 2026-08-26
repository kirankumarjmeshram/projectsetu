"use client";

import { useEffect, useState, useTransition } from "react";

import {
  buildReportPreviewAction,
  downloadReportArtifactAction,
  generateReportVersionAction,
  listReportVersionsAction,
} from "@/app/actions/report-actions";
import type {
  DprReportModel,
  NarrativeOverrides,
  ReportValidationIssue,
} from "@/lib/reports/contracts";
import type { PersistedReportMetadata } from "@/lib/persistence/repositories";

export function ReportGenerationPanel({ projectId }: { projectId: string }) {
  const [preview, setPreview] = useState<DprReportModel | null>(null);
  const [issues, setIssues] = useState<readonly ReportValidationIssue[]>([]);
  const [reports, setReports] = useState<readonly PersistedReportMetadata[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [overrides, setOverrides] = useState<NarrativeOverrides>({});
  const [pending, startTransition] = useTransition();

  const refreshHistory = async () => {
    const result = await listReportVersionsAction(projectId);
    if (result.success) setReports(result.reports);
  };
  useEffect(() => {
    let active = true;
    void listReportVersionsAction(projectId).then((result) => {
      if (active && result.success) setReports(result.reports);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  const buildPreview = () =>
    startTransition(async () => {
      setMessage("");
      const result = await buildReportPreviewAction(projectId);
      if (!result.success) return setMessage(result.error);
      setPreview(result.model);
      setIssues(result.validation.issues);
    });
  const generate = () =>
    startTransition(async () => {
      setMessage("");
      const result = await generateReportVersionAction(projectId, overrides);
      if (!result.success) return setMessage(result.error);
      setMessage(`DPR Version ${result.report.reportVersion} is ready.`);
      await refreshHistory();
    });
  const download = (reportId: string, format: "PDF" | "DOCX" | "XLSX") =>
    startTransition(async () => {
      const result = await downloadReportArtifactAction(
        projectId,
        reportId,
        format,
      );
      if (!result.success) return setMessage(result.error);
      const bytes = Uint8Array.from(atob(result.base64), (character) =>
        character.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: result.mimeType }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    });

  const editable =
    preview?.sections.filter((section) =>
      [
        "executive-summary",
        "market-sales",
        "risks-mitigation",
        "conclusion",
      ].includes(section.id),
    ) ?? [];
  return (
    <section
      className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5"
      aria-label="DPR report generation"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Detailed Project Report
          </h3>
          <p className="text-xs text-slate-600">
            Preview validation, review narrative, then create immutable PDF,
            Word and Excel artifacts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={buildPreview}
            disabled={pending}
            className="rounded-lg border border-emerald-700 bg-white px-4 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"
          >
            Preview DPR
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={
              pending ||
              !preview ||
              issues.some((issue) => issue.severity === "BLOCKING")
            }
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "Working…" : "Generate DPR"}
          </button>
        </div>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-white p-3 text-xs text-slate-700"
        >
          {message}
        </p>
      )}
      {preview && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <span>
              <b>{preview.sections.length}</b> sections
            </span>
            <span>
              <b>{preview.project.project.projectionPeriodYears}</b> projection
              years
            </span>
            <span>
              Template <b>{preview.identity.templateVersion}</b>
            </span>
          </div>
          {issues.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={
                    issue.severity === "BLOCKING"
                      ? "text-rose-700"
                      : issue.severity === "MANUAL_REVIEW"
                        ? "text-amber-700"
                        : "text-slate-600"
                  }
                >
                  {issue.severity}: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {editable.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-xs font-bold text-slate-800">
            Review and approve narrative
          </summary>
          <div className="mt-4 space-y-4">
            {editable.map((section) => (
              <label
                key={section.id}
                className="block text-xs font-semibold text-slate-700"
              >
                {section.title}
                <textarea
                  value={
                    overrides[section.id]?.text ?? section.narrative?.text ?? ""
                  }
                  onChange={(event) =>
                    setOverrides({
                      ...overrides,
                      [section.id]: {
                        text: event.target.value,
                        approved: true,
                      },
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal"
                />
              </label>
            ))}
          </div>
        </details>
      )}
      <div>
        <h4 className="mb-2 text-xs font-bold tracking-wide text-slate-600 uppercase">
          Report Versions
        </h4>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-500">No report versions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-2">Version</th>
                  <th className="p-2">Generated</th>
                  <th className="p-2">Input Snapshot</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-slate-100">
                    <td className="p-2">v{report.reportVersion}</td>
                    <td className="p-2">
                      {report.generatedAt?.toLocaleString() ?? "—"}
                    </td>
                    <td className="p-2 font-mono">
                      {report.inputSnapshotId?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="p-2">{report.status}</td>
                    <td className="flex gap-1 p-2">
                      {(["PDF", "DOCX", "XLSX"] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          disabled={report.status !== "READY" || pending}
                          onClick={() => download(report.id, format)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-40"
                        >
                          {format === "DOCX"
                            ? "Word"
                            : format === "XLSX"
                              ? "Excel"
                              : "PDF"}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
