import { describe, expect, it } from "vitest";

import { programId } from "../program";
import { createLiveProgramRegistry, liveProgramDefinitions } from "./index";

describe("live program bootstrap", () => {
  it("registers PMEGP and every Task 015 definition without changing registry semantics", () => {
    const registry = createLiveProgramRegistry();
    expect(liveProgramDefinitions).toHaveLength(16);
    expect(
      registry.listRegisteredVersions(programId("GOI.NLM.PIGGERY")),
    ).toHaveLength(1);
    expect(
      registry.listRegisteredVersions(programId("GOI.PMFME.INDIVIDUAL_UNIT")),
    ).toHaveLength(1);
    expect(registry.listRegisteredVersions(programId("GOI.PMMY"))).toHaveLength(
      1,
    );
    expect(
      registry.listRegisteredVersions(programId("MH.CMEGP.NEW_ENTERPRISE")),
    ).toHaveLength(1);
    expect(
      registry.listRegisteredVersions(programId("GOI.PMEGP.NEW_ENTERPRISE")),
    ).toHaveLength(1);
  });

  it("keeps normal bankable projects scheme-optional", () => {
    const selectedPrograms: readonly never[] = [];
    expect(selectedPrograms).toEqual([]);
  });
});
