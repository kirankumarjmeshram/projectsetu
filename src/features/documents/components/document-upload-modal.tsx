"use client";

import React, { useState, useTransition } from "react";

import { uploadDocumentAction } from "@/app/actions/document-actions";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/documents/contracts";
import type { PersistedDocumentMetadata } from "@/lib/persistence/repositories";

interface DocumentUploadModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (document: PersistedDocumentMetadata) => void;
  initialKind?: DocumentKind;
}

export function DocumentUploadModal({
  projectId,
  isOpen,
  onClose,
  onUploadSuccess,
  initialKind = "QUOTATION",
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DocumentKind>(initialKind);
  const [displayName, setDisplayName] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!displayName) {
        setDisplayName(selected.name.replace(/\.[^/.]+$/, ""));
      }
      setError(null);
      setWarning(null);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a document file to upload.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setWarning(null);
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("kind", kind);
      formData.append("displayName", displayName);
      formData.append("file", file);

      const res = await uploadDocumentAction(formData);
      if (res.success && res.document) {
        if (res.warning) {
          setWarning(res.warning);
        }
        onUploadSuccess(res.document);
        onClose();
      } else {
        setError(res.error || "Failed to upload document.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Upload Project Document
            </h3>
            <p className="text-xs text-slate-500">
              Attach supplier quotations, land records, approvals, or DPR
              evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}
          {warning && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800">
              {warning}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Document Type *
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
            >
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Display Name / Title
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              placeholder="e.g. Acme Feed Mill Equipment Quotation"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Select File (PDF, PNG, JPG, WebP) *
            </label>
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center hover:bg-slate-50">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                className="hidden"
                id="doc-upload-input"
              />
              <label
                htmlFor="doc-upload-input"
                className="cursor-pointer space-y-1"
              >
                <div className="text-2xl">📄</div>
                <div className="text-xs font-semibold text-emerald-700 hover:underline">
                  {file ? file.name : "Click to choose file or drag & drop"}
                </div>
                <div className="text-[11px] text-slate-400">
                  Maximum file size: 15 MB
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !file}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
