export interface ReportCalculationRunCandidate {
  readonly status: string;
  readonly inputSnapshotId: string;
  readonly startedAt: Date;
}

export function selectLatestCurrentCalculationRun<
  T extends ReportCalculationRunCandidate,
>(runs: readonly T[], currentInputSnapshotId: string | null): T | undefined {
  if (!currentInputSnapshotId) return undefined;
  return runs
    .filter(
      (run) =>
        run.status === "COMPLETED" &&
        run.inputSnapshotId === currentInputSnapshotId,
    )
    .sort(
      (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
    )[0];
}
