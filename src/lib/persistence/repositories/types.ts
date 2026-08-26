/**
 * Provider-independent repository interfaces for persistence.
 *
 * These interfaces define the contract between the application layer and
 * the persistence layer. Implementations may use PostgreSQL, in-memory
 * stores, or any other backend.
 *
 * Domain types are imported as type-only references — no persistence
 * coupling leaks into the domain.
 */

// ─── Common types ───────────────────────────────────────────────────────────

export interface PersistenceTimestamps {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ConcurrencyConflictError {
  readonly code: "CONCURRENCY_CONFLICT";
  readonly entityId: string;
  readonly expectedRevision: number;
  readonly message: string;
}

export interface EntityNotFoundError {
  readonly code: "ENTITY_NOT_FOUND";
  readonly entityType: string;
  readonly entityId: string;
  readonly message: string;
}

export type RepositoryError = ConcurrencyConflictError | EntityNotFoundError;

export type RepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RepositoryError };

// ─── Project ────────────────────────────────────────────────────────────────

export interface PersistedProject {
  readonly id: string;
  readonly name: string;
  readonly mode: string;
  readonly industryActivity: string;
  readonly stage: string;
  readonly status: string;
  readonly areaClassification: string;
  readonly location: unknown;
  readonly projectionPeriodYears: number;
  readonly implementationFrom: string | null;
  readonly implementationUntil: string | null;
  readonly currentInputSnapshotId: string | null;
  readonly ownerId?: string | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProjectInput {
  readonly id?: string;
  readonly name: string;
  readonly mode: string;
  readonly industryActivity: string;
  readonly stage: string;
  readonly status?: string;
  readonly areaClassification?: string;
  readonly location?: unknown;
  readonly projectionPeriodYears: number;
  readonly implementationFrom?: string;
  readonly implementationUntil?: string;
  readonly ownerId?: string | null;
}

export interface UpdateProjectInput {
  readonly name?: string;
  readonly mode?: string;
  readonly industryActivity?: string;
  readonly stage?: string;
  readonly status?: string;
  readonly areaClassification?: string;
  readonly location?: unknown;
  readonly projectionPeriodYears?: number;
  readonly implementationFrom?: string | null;
  readonly implementationUntil?: string | null;
  readonly currentInputSnapshotId?: string | null;
  readonly ownerId?: string | null;
}

export interface ProjectRepository {
  /**
   * Creates a new project. Returns the persisted project with generated ID.
   */
  create(input: CreateProjectInput): Promise<PersistedProject>;

  /**
   * Finds a project by ID. Returns null if not found.
   */
  findById(id: string): Promise<PersistedProject | null>;

  /**
   * Lists all projects (future: with pagination/filtering).
   */
  findAll(): Promise<readonly PersistedProject[]>;

  /**
   * Lists all projects owned by a specific user.
   */
  findByOwnerId(ownerId: string): Promise<readonly PersistedProject[]>;

  /**
   * Updates a project with optimistic concurrency control.
   * The update only succeeds if the current revision matches expectedRevision.
   */
  update(
    id: string,
    expectedRevision: number,
    input: UpdateProjectInput,
  ): Promise<RepositoryResult<PersistedProject>>;

  /**
   * Archives a project (soft delete).
   */
  archive(
    id: string,
    expectedRevision: number,
  ): Promise<RepositoryResult<PersistedProject>>;

  /**
   * Hard deletes a project. For tests/admin only — not part of normal workflow.
   */
  hardDelete(id: string): Promise<boolean>;
}

// ─── Input Snapshot ─────────────────────────────────────────────────────────

export interface PersistedInputSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly snapshotType: string;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly data: unknown;
  readonly createdAt: Date;
}

export interface CreateInputSnapshotInput {
  readonly id?: string;
  readonly projectId: string;
  readonly snapshotType?: string;
  readonly schemaVersion?: number;
  readonly revision: number;
  readonly data: unknown;
}

export interface InputSnapshotRepository {
  create(input: CreateInputSnapshotInput): Promise<PersistedInputSnapshot>;
  findById(id: string): Promise<PersistedInputSnapshot | null>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedInputSnapshot[]>;
  findLatestByProjectId(
    projectId: string,
  ): Promise<PersistedInputSnapshot | null>;
}

// ─── Program Selection ──────────────────────────────────────────────────────

export interface PersistedProgramSelection {
  readonly id: string;
  readonly projectId: string;
  readonly programId: string;
  readonly versionId: string | null;
  readonly createdAt: Date;
}

export interface CreateProgramSelectionInput {
  readonly id?: string;
  readonly projectId: string;
  readonly programId: string;
  readonly versionId?: string;
}

export interface ProgramSelectionRepository {
  create(
    input: CreateProgramSelectionInput,
  ): Promise<PersistedProgramSelection>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedProgramSelection[]>;
  deleteByProjectId(projectId: string): Promise<number>;
  replaceForProject(
    projectId: string,
    selections: readonly CreateProgramSelectionInput[],
  ): Promise<readonly PersistedProgramSelection[]>;
}

// ─── Calculation Run ────────────────────────────────────────────────────────

export interface PersistedCalculationRun {
  readonly id: string;
  readonly projectId: string;
  readonly inputSnapshotId: string;
  readonly status: string;
  readonly triggeredBy: string | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface CreateCalculationRunInput {
  readonly id?: string;
  readonly projectId: string;
  readonly inputSnapshotId: string;
  readonly status?: string;
  readonly triggeredBy?: string;
}

export interface CalculationRunRepository {
  create(input: CreateCalculationRunInput): Promise<PersistedCalculationRun>;
  findById(id: string): Promise<PersistedCalculationRun | null>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedCalculationRun[]>;
  complete(
    id: string,
    status: "COMPLETED" | "FAILED",
  ): Promise<PersistedCalculationRun | null>;
}

// ─── Calculation Snapshot ───────────────────────────────────────────────────

export interface PersistedCalculationSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly calculationRunId: string;
  readonly snapshotType: string;
  readonly schemaVersion: number;
  readonly data: unknown;
  readonly createdAt: Date;
}

export interface CreateCalculationSnapshotInput {
  readonly id?: string;
  readonly projectId: string;
  readonly calculationRunId: string;
  readonly snapshotType: string;
  readonly schemaVersion?: number;
  readonly data: unknown;
}

export interface CalculationSnapshotRepository {
  create(
    input: CreateCalculationSnapshotInput,
  ): Promise<PersistedCalculationSnapshot>;
  findById(id: string): Promise<PersistedCalculationSnapshot | null>;
  findByCalculationRunId(
    calculationRunId: string,
  ): Promise<readonly PersistedCalculationSnapshot[]>;
}

// ─── Funding Snapshot ───────────────────────────────────────────────────────

export interface PersistedFundingSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly calculationRunId: string;
  readonly snapshotType: string;
  readonly schemaVersion: number;
  readonly data: unknown;
  readonly createdAt: Date;
}

export interface CreateFundingSnapshotInput {
  readonly id?: string;
  readonly projectId: string;
  readonly calculationRunId: string;
  readonly snapshotType?: string;
  readonly schemaVersion?: number;
  readonly data: unknown;
}

export interface FundingSnapshotRepository {
  create(input: CreateFundingSnapshotInput): Promise<PersistedFundingSnapshot>;
  findById(id: string): Promise<PersistedFundingSnapshot | null>;
  findByCalculationRunId(
    calculationRunId: string,
  ): Promise<readonly PersistedFundingSnapshot[]>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedFundingSnapshot[]>;
}

// ─── Document Metadata ──────────────────────────────────────────────────────

export interface PersistedDocumentMetadata {
  readonly id: string;
  readonly projectId: string;
  readonly kind: string;
  readonly displayName: string | null;
  readonly originalFilename: string | null;
  readonly version: string | null;
  readonly storageKey: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: string | null;
  readonly checksumSha256: string | null;
  readonly status: string;
  readonly supersededById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateDocumentMetadataInput {
  readonly id?: string;
  readonly projectId: string;
  readonly kind: string;
  readonly displayName?: string;
  readonly originalFilename?: string;
  readonly version?: string;
  readonly storageKey?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: string;
  readonly checksumSha256?: string;
  readonly status?: string;
  readonly supersededById?: string;
}

export interface DocumentMetadataRepository {
  create(
    input: CreateDocumentMetadataInput,
  ): Promise<PersistedDocumentMetadata>;
  findById(id: string): Promise<PersistedDocumentMetadata | null>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedDocumentMetadata[]>;
  update(
    id: string,
    input: Partial<CreateDocumentMetadataInput>,
  ): Promise<PersistedDocumentMetadata | null>;
}

// ─── Quotation Extraction & Review ──────────────────────────────────────────

export interface PersistedQuotationExtraction {
  readonly id: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly status: string;
  readonly extractionProvider: string;
  readonly rawData: unknown;
  readonly normalizedData: unknown;
  readonly confidenceScore: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateQuotationExtractionInput {
  readonly id?: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly status?: string;
  readonly extractionProvider: string;
  readonly rawData: unknown;
  readonly normalizedData: unknown;
  readonly confidenceScore?: string;
}

export interface QuotationExtractionRepository {
  create(
    input: CreateQuotationExtractionInput,
  ): Promise<PersistedQuotationExtraction>;
  findById(id: string): Promise<PersistedQuotationExtraction | null>;
  findByDocumentId(
    documentId: string,
  ): Promise<readonly PersistedQuotationExtraction[]>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationExtraction[]>;
  updateStatus(
    id: string,
    status: string,
  ): Promise<PersistedQuotationExtraction | null>;
}

export interface PersistedQuotationReview {
  readonly id: string;
  readonly projectId: string;
  readonly extractionId: string;
  readonly status: string;
  readonly reviewedData: unknown;
  readonly reviewerNotes: string | null;
  readonly approvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateQuotationReviewInput {
  readonly id?: string;
  readonly projectId: string;
  readonly extractionId: string;
  readonly status?: string;
  readonly reviewedData: unknown;
  readonly reviewerNotes?: string;
  readonly approvedAt?: Date;
}

export interface QuotationReviewRepository {
  create(input: CreateQuotationReviewInput): Promise<PersistedQuotationReview>;
  findById(id: string): Promise<PersistedQuotationReview | null>;
  findByExtractionId(
    extractionId: string,
  ): Promise<readonly PersistedQuotationReview[]>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationReview[]>;
  update(
    id: string,
    input: Partial<CreateQuotationReviewInput>,
  ): Promise<PersistedQuotationReview | null>;
}

export interface PersistedQuotationLineMapping {
  readonly id: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly quotationLineId: string;
  readonly projectCostItemId: string | null;
  readonly costCategory: string;
  readonly sourceAmount: string;
  readonly mappedAmount: string;
  readonly mappingType: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateQuotationLineMappingInput {
  readonly id?: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly quotationLineId: string;
  readonly projectCostItemId?: string;
  readonly costCategory: string;
  readonly sourceAmount: string;
  readonly mappedAmount: string;
  readonly mappingType?: string;
  readonly status?: string;
}

export interface QuotationLineMappingRepository {
  create(
    input: CreateQuotationLineMappingInput,
  ): Promise<PersistedQuotationLineMapping>;
  findById(id: string): Promise<PersistedQuotationLineMapping | null>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationLineMapping[]>;
  findByDocumentId(
    documentId: string,
  ): Promise<readonly PersistedQuotationLineMapping[]>;
  updateStatus(
    id: string,
    status: string,
  ): Promise<PersistedQuotationLineMapping | null>;
}

// ─── Report Metadata ────────────────────────────────────────────────────────

export interface PersistedReportMetadata {
  readonly id: string;
  readonly projectId: string;
  readonly reportType: string;
  readonly reportVersion: number;
  readonly templateReference: string | null;
  readonly inputSnapshotId: string | null;
  readonly calculationRunId: string | null;
  readonly fundingSnapshotId: string | null;
  readonly templateVersion: string;
  readonly contentSchemaVersion: number;
  readonly status: string;
  readonly programContext: unknown;
  readonly sections: unknown;
  readonly content: unknown;
  readonly narrativeOverrides: unknown;
  readonly generatedDocumentId: string | null;
  readonly pdfDocumentId: string | null;
  readonly docxDocumentId: string | null;
  readonly excelDocumentId: string | null;
  readonly generatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateReportMetadataInput {
  readonly id?: string;
  readonly projectId: string;
  readonly reportType: string;
  readonly reportVersion?: number;
  readonly templateReference?: string;
  readonly inputSnapshotId?: string;
  readonly calculationRunId?: string;
  readonly fundingSnapshotId?: string;
  readonly templateVersion?: string;
  readonly contentSchemaVersion?: number;
  readonly status?: string;
  readonly programContext?: unknown;
  readonly sections?: unknown;
  readonly content?: unknown;
  readonly narrativeOverrides?: unknown;
  readonly generatedDocumentId?: string;
  readonly pdfDocumentId?: string;
  readonly docxDocumentId?: string;
  readonly excelDocumentId?: string;
  readonly generatedAt?: Date;
}

export interface ReportMetadataRepository {
  create(input: CreateReportMetadataInput): Promise<PersistedReportMetadata>;
  findById(id: string): Promise<PersistedReportMetadata | null>;
  findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedReportMetadata[]>;
  update(
    id: string,
    input: Partial<CreateReportMetadataInput>,
  ): Promise<PersistedReportMetadata | null>;
}

// ─── User, Session & Admin Audit ────────────────────────────────────────────

export interface PersistedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: "USER" | "ADMIN";
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateUserInput {
  readonly id?: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role?: "USER" | "ADMIN";
  readonly isActive?: boolean;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<PersistedUser>;
  findById(id: string): Promise<PersistedUser | null>;
  findByEmail(email: string): Promise<PersistedUser | null>;
  findAll(): Promise<readonly PersistedUser[]>;
  updateRole(id: string, role: "USER" | "ADMIN"): Promise<PersistedUser | null>;
  updateActiveStatus(
    id: string,
    isActive: boolean,
  ): Promise<PersistedUser | null>;
  delete(id: string): Promise<boolean>;
}

export interface PersistedSession {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface CreateSessionInput {
  readonly id?: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<PersistedSession>;
  findByToken(token: string): Promise<PersistedSession | null>;
  deleteByToken(token: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<number>;
  deleteExpired(): Promise<number>;
}

export interface PersistedAdminAuditLog {
  readonly id: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata: unknown;
  readonly createdAt: Date;
}

export interface CreateAdminAuditLogInput {
  readonly id?: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata?: unknown;
}

export interface AdminAuditRepository {
  create(input: CreateAdminAuditLogInput): Promise<PersistedAdminAuditLog>;
  findAll(limit?: number): Promise<readonly PersistedAdminAuditLog[]>;
  findByEntityType(
    entityType: string,
    limit?: number,
  ): Promise<readonly PersistedAdminAuditLog[]>;
}
