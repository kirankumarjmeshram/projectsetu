import { describe, expect, it } from "vitest";

import { selectLatestCurrentCalculationRun } from "./source-selection";

describe("report calculation source selection", () => {
  it("never selects a completed calculation from a stale input snapshot", () => {
    const stale = {
      id: "stale",
      status: "COMPLETED",
      inputSnapshotId: "input-v1",
      startedAt: new Date("2026-01-02T00:00:00Z"),
    };
    expect(
      selectLatestCurrentCalculationRun([stale], "input-v2"),
    ).toBeUndefined();
  });

  it("selects the latest completed run for the exact current snapshot", () => {
    const older = {
      id: "older",
      status: "COMPLETED",
      inputSnapshotId: "input-v2",
      startedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const latest = {
      ...older,
      id: "latest",
      startedAt: new Date("2026-01-03T00:00:00Z"),
    };
    expect(
      selectLatestCurrentCalculationRun([older, latest], "input-v2")?.id,
    ).toBe("latest");
  });
});
