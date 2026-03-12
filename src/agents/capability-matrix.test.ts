import { describe, expect, test } from "bun:test";

import {
  buildAgentPromptInvariantSection,
  buildHeidiAgentCapabilityMatrixSection,
  getHeidiAgentCapabilityProfile,
} from "./capability-matrix";

describe("Heidi agent capability matrix", () => {
  test("contains the four primary Heidi agents", () => {
    // given
    const matrix = buildHeidiAgentCapabilityMatrixSection();

    // then
    expect(matrix).toContain("Sisyphus");
    expect(matrix).toContain("Hephaestus");
    expect(matrix).toContain("Prometheus");
    expect(matrix).toContain("Atlas");
  });

  test("stores verification obligations for each agent", () => {
    // when
    const sisyphus = getHeidiAgentCapabilityProfile("sisyphus");
    const hephaestus = getHeidiAgentCapabilityProfile("hephaestus");
    const prometheus = getHeidiAgentCapabilityProfile("prometheus");
    const atlas = getHeidiAgentCapabilityProfile("atlas");

    // then
    expect(sisyphus.verificationRequirement).toContain("Verify every delegated result");
    expect(hephaestus.verificationRequirement).toContain("verify and integrate");
    expect(prometheus.verificationRequirement).toContain("Verify that the plan");
    expect(atlas.verificationRequirement).toContain("verify outcomes and remaining gaps");
  });

  test("builds an invariant section from the same source of truth", () => {
    // when
    const invariantSection = buildAgentPromptInvariantSection("atlas");

    // then
    expect(invariantSection).toContain("Atlas Prompt Invariants");
    expect(invariantSection).toContain("Verify each delegated outcome before closing the corresponding task.");
  });
});