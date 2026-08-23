export const validationSeverities = ["ERROR", "WARNING", "INFO"] as const;

export type ValidationSeverity = (typeof validationSeverities)[number];

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ValidationResult {
  readonly issues: readonly ValidationIssue[];
}

export function hasValidationErrors(result: ValidationResult): boolean {
  return result.issues.some(({ severity }) => severity === "ERROR");
}
