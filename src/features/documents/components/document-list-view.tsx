"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";

import {
  archiveDocumentAction,
  getDocumentFileAction,
  listProjectDocumentsAction,
} from "@/app/actions/document-actions";
import {
  extractQuotationAction,
  getQuotationDetailsAction,
  getQuotationMappingsAction,
} from "@/app/actions/quotation-actions";
import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import {
  DOCUMENT_KINDS,
  type DocumentMetadataRecord,
} from "@/lib/documents/contracts";
import type {
  NormalizedQuotation,
  QuotationLineMapping,
} from "@/lib/documents/quotation/contracts";

import { DocumentUploadModal } from "./document-upload-modal";
import { QuotationComparisonView } from "./quotation-comparison-view";
import { QuotationManualForm } from "./quotation-manual-form";
import { QuotationMappingModal } from "./quotation-mapping-modal";
import { QuotationReviewModal } from "./quotation-review-modal";

interface DocumentListViewProps {
  projectId: string;
  existingCostItems: readonly ProjectCostItemInput[];
  onUpdateCostItems: (updatedItems: readonly ProjectCostItemInput[]) => void;
}

export function DocumentListView({
  projectId,
  existingCostItems,
  onUpdateCostItems,
}: DocumentListViewProps) {
  const [documents, setDocuments] = useState<DocumentMetadataRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Modals & workflows
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [activeReviewQuote, setActiveReviewQuote] = useState<{
    extractionId: string;
    quotation: NormalizedQuotation;
  } | null>(null);
  const [activeMappingQuote, setActiveMappingQuote] =
    useState<NormalizedQuotation | null>(null);
  const [activeMappings, setActiveMappings] = useState<QuotationLineMapping[]>(
    [],
  );
  const [comparisonDocIds, setComparisonDocIds] = useState<string[] | null>(
    null,
  );

  const loadDocuments = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await listProjectDocumentsAction(projectId);
      if (res.success && res.documents) {
        setDocuments(res.documents as unknown as DocumentMetadataRecord[]);
      } else {
        setError(res.error || "Failed to load documents.");
      }

      const mapRes = await getQuotationMappingsAction(projectId);
      if (mapRes.success && mapRes.mappings) {
        setActiveMappings(mapRes.mappings as unknown as QuotationLineMapping[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDownload = async (docId: string) => {
    const res = await getDocumentFileAction(docId);
    if (res.success && res.base64) {
      const link = document.createElement("a");
      link.href = `data:${res.mimeType};base64,${res.base64}`;
      link.download = res.filename || "document";
      link.click();
    } else {
      alert(res.error || "Failed to retrieve file.");
    }
  };

  const handleArchive = (docId: string) => {
    if (!confirm("Are you sure you want to archive this document?")) return;
    startTransition(async () => {
      const res = await archiveDocumentAction(docId);
      if (res.success) {
        loadDocuments();
      } else {
        alert(res.error || "Failed to archive document.");
      }
    });
  };

  const handleOpenQuotationReview = async (doc: DocumentMetadataRecord) => {
    const details = await getQuotationDetailsAction(doc.id);
    if (details.success && details.extraction) {
      const ext = details.extraction;
      const quote = (details.review?.reviewedData ||
        ext.normalizedData) as NormalizedQuotation;
      if (quote && quote.lineItems) {
        setActiveReviewQuote({ extractionId: ext.id, quotation: quote });
        return;
      }
    }

    // Try extracting if no extraction exists
    const extractRes = await extractQuotationAction(doc.id);
    if (extractRes.success && extractRes.extraction) {
      const ext = extractRes.extraction;
      const quote = ext.normalizedData as NormalizedQuotation;
      if (quote && quote.lineItems) {
        setActiveReviewQuote({ extractionId: ext.id, quotation: quote });
      } else {
        alert(
          "Document requires manual data entry. Opening manual quotation form.",
        );
        setIsManualFormOpen(true);
      }
    } else {
      alert(extractRes.error || "Failed to extract quotation.");
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (d.status === "ARCHIVED") return false;
    if (activeFilter === "ALL") return true;
    return d.kind === activeFilter;
  });

  const quotationDocs = documents.filter(
    (d) => d.kind === "QUOTATION" && d.status !== "ARCHIVED",
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Project Documents & Quotations
          </h2>
          <p className="text-xs text-slate-500">
            Upload supplier quotations, land titles, DPR evidence, and
            certificates. Extract and map machinery quotes to Project Cost.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quotationDocs.length >= 2 && (
            <button
              type="button"
              onClick={() =>
                setComparisonDocIds(quotationDocs.map((d) => d.id))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              ⚖️ Compare Quotations ({quotationDocs.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsManualFormOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            + Enter Quotation Manually
          </button>

          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            + Upload Document
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Manual Form View if active */}
      {isManualFormOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <QuotationManualForm
            projectId={projectId}
            onSuccess={(quote) => {
              setIsManualFormOpen(false);
              loadDocuments();
              setActiveMappingQuote(quote);
            }}
            onCancel={() => setIsManualFormOpen(false)}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter("ALL")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            activeFilter === "ALL"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Documents (
          {documents.filter((d) => d.status !== "ARCHIVED").length})
        </button>
        {DOCUMENT_KINDS.map((kind) => {
          const count = documents.filter(
            (d) => d.kind === kind && d.status !== "ARCHIVED",
          ).length;
          if (count === 0 && activeFilter !== kind) return null;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setActiveFilter(kind)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeFilter === kind
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {kind.replace(/_/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      {/* Documents Table */}
      {isPending && documents.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-500">
          Loading project documents...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="text-3xl">📁</div>
          <h3 className="mt-2 text-sm font-bold text-slate-900">
            No documents uploaded yet
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload supplier machinery quotations, land ownership records,
            registration certificates, or DPR attachments.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Upload First Document
            </button>
            <button
              type="button"
              onClick={() => setIsManualFormOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Enter Quotation Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 uppercase">
              <tr>
                <th className="px-4 py-3">Document Title / File</th>
                <th className="w-32 px-3 py-3">Type</th>
                <th className="w-28 px-3 py-3">Status</th>
                <th className="w-24 px-3 py-3 text-right">Size</th>
                <th className="w-32 px-3 py-3">Uploaded</th>
                <th className="w-48 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => {
                const sizeKb = doc.sizeBytes
                  ? (parseInt(doc.sizeBytes, 10) / 1024).toFixed(0)
                  : "-";
                const isQuotation = doc.kind === "QUOTATION";

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>
                        {doc.displayName ||
                          doc.originalFilename ||
                          "Untitled Document"}
                      </div>
                      {doc.originalFilename && (
                        <div className="font-mono text-[11px] text-slate-400">
                          {doc.originalFilename}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                        {doc.kind.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          doc.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : doc.status === "EXTRACTED"
                              ? "bg-blue-100 text-blue-800"
                              : doc.status === "REVIEW_REQUIRED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      {sizeKb} KB
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="space-x-1.5 px-4 py-3 text-right">
                      {isQuotation && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuotationReview(doc)}
                          className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Review & Map
                        </button>
                      )}

                      {doc.storageKey && (
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id)}
                          className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Download
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleArchive(doc.id)}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Archive"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <DocumentUploadModal
        projectId={projectId}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={(doc) => {
          loadDocuments();
          if (doc.kind === "QUOTATION") {
            handleOpenQuotationReview(doc as unknown as DocumentMetadataRecord);
          }
        }}
      />

      {activeReviewQuote && (
        <QuotationReviewModal
          projectId={projectId}
          extractionId={activeReviewQuote.extractionId}
          quotation={activeReviewQuote.quotation}
          isOpen={true}
          onClose={() => setActiveReviewQuote(null)}
          onApproveSuccess={() => loadDocuments()}
          onOpenMapping={(quote) => {
            setActiveReviewQuote(null);
            setActiveMappingQuote(quote);
          }}
        />
      )}

      {activeMappingQuote && (
        <QuotationMappingModal
          quotation={activeMappingQuote}
          existingCostItems={existingCostItems}
          existingMappings={activeMappings}
          isOpen={true}
          onClose={() => setActiveMappingQuote(null)}
          onMappingSuccess={(updated) => {
            onUpdateCostItems(updated);
            loadDocuments();
          }}
        />
      )}

      {comparisonDocIds && (
        <QuotationComparisonView
          projectId={projectId}
          documentIds={comparisonDocIds}
          onClose={() => setComparisonDocIds(null)}
        />
      )}
    </div>
  );
}
