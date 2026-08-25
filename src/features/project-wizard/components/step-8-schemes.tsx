import React from "react";

import type { ProgramSelectionInput } from "@/lib/application/orchestrator/orchestrator-types";
import { SCHEME_UI_DESCRIPTORS } from "@/features/schemes/registry";
import type {
  SchemeFieldDefinition,
  SchemeUiDescriptor,
} from "@/features/schemes/types";

interface Step8SchemesProps {
  selectedPrograms: readonly ProgramSelectionInput[];
  schemeFacts: Record<string, unknown>;
  onProgramChange: (programs: readonly ProgramSelectionInput[]) => void;
  onFactsChange: (facts: Record<string, unknown>) => void;
}

export function Step8Schemes({
  selectedPrograms,
  schemeFacts,
  onProgramChange,
  onFactsChange,
}: Step8SchemesProps) {
  const isSelected = (id: string) =>
    selectedPrograms.some((p) => p.programId === id);

  const toggleProgram = (scheme: SchemeUiDescriptor) => {
    if (isSelected(scheme.programId)) {
      onProgramChange(
        selectedPrograms.filter((p) => p.programId !== scheme.programId),
      );
    } else {
      // Add program and populate default dynamic facts if not already present
      const updatedFacts = { ...schemeFacts };
      for (const field of scheme.dynamicFields) {
        if (
          updatedFacts[field.key] === undefined &&
          field.defaultValue !== undefined
        ) {
          updatedFacts[field.key] = field.defaultValue;
        }
      }
      onFactsChange(updatedFacts);
      onProgramChange([...selectedPrograms, { programId: scheme.programId }]);
    }
  };

  const handleFactUpdate = (key: string, val: unknown) => {
    onFactsChange({
      ...schemeFacts,
      [key]: val,
    });
  };

  const activeDescriptors = SCHEME_UI_DESCRIPTORS.filter((s) =>
    isSelected(s.programId),
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Step 8: Government Financing & Subsidy Programs
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Select zero, one, or multiple government schemes to calculate margin
          money subsidies, capital assistance, and convergence compatibility.
        </p>
      </div>

      {/* Program Selection Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SCHEME_UI_DESCRIPTORS.map((scheme) => {
          const selected = isSelected(scheme.programId);
          return (
            <div
              key={scheme.programId}
              onClick={() => toggleProgram(scheme)}
              className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-all ${
                selected
                  ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="block text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
                    {scheme.sponsoringAgency}
                  </span>
                  <h4 className="mt-0.5 text-sm font-bold text-slate-900">
                    {scheme.name}
                  </h4>
                </div>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {}} // handled by div click
                  className="pointer-events-none mt-1 h-4 w-4 rounded-sm border-slate-300 text-emerald-600"
                />
              </div>

              <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                {scheme.shortSummary}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-500">
                <span>{scheme.subsidyRateDescription}</span>
                <span className="font-semibold text-slate-700">
                  {scheme.maxProjectCost}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Scheme Facts Section */}
      {activeDescriptors.length > 0 && (
        <div className="space-y-6 border-t border-slate-200 pt-4">
          <h4 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
            Required Eligibility Facts & Scheme Questionnaires
          </h4>

          {activeDescriptors.map((scheme) => (
            <div
              key={scheme.programId}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-emerald-800 uppercase">
                  {scheme.code} Questionnaire
                </span>
                <h5 className="text-sm font-bold text-slate-900">
                  {scheme.name}
                </h5>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {scheme.dynamicFields.map((field) => (
                  <DynamicFieldInput
                    key={field.key}
                    field={field}
                    currentValue={schemeFacts[field.key]}
                    onChange={(v) => handleFactUpdate(field.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DynamicFieldInput({
  field,
  currentValue,
  onChange,
}: {
  field: SchemeFieldDefinition;
  currentValue: unknown;
  onChange: (val: unknown) => void;
}) {
  const val =
    currentValue !== undefined ? currentValue : (field.defaultValue ?? "");

  if (field.type === "BOOLEAN") {
    return (
      <div className="flex items-center gap-2 pt-2 md:col-span-2">
        <input
          type="checkbox"
          id={field.key}
          className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600"
          checked={Boolean(val)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label
          htmlFor={field.key}
          className="cursor-pointer text-xs font-semibold text-slate-800"
        >
          {field.label}
          {field.description && (
            <span className="block text-[11px] font-normal text-slate-500">
              {field.description}
            </span>
          )}
        </label>
      </div>
    );
  }

  if (field.type === "RADIO" && field.options) {
    return (
      <div className="space-y-1.5 md:col-span-2">
        <label className="block text-xs font-semibold text-slate-700">
          {field.label}
        </label>
        <div className="flex flex-wrap gap-4 pt-1">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
            >
              <input
                type="radio"
                name={field.key}
                value={opt.value}
                checked={val === opt.value}
                onChange={(e) => onChange(e.target.value)}
                className="border-slate-300 text-emerald-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "SELECT" && field.options) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700">
          {field.label}
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          value={String(val)}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.description && (
          <span className="block text-[10px] text-slate-500">
            {field.description}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700">
        {field.label}
      </label>
      <input
        type={field.type === "NUMBER" ? "number" : "text"}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
        value={String(val)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description && (
        <span className="block text-[10px] text-slate-500">
          {field.description}
        </span>
      )}
    </div>
  );
}
