import { describe, expect, test } from "bun:test";

import { createSisyphusAgent } from "./sisyphus";
import { createHephaestusAgent } from "./hephaestus/agent";
import { createAtlasAgent } from "./atlas/agent";
import { getPrometheusPrompt } from "./prometheus";

describe("Heidi agent prompt delegation invariants", () => {
  test("Sisyphus prompt includes the capability matrix and delegation verification contract", () => {
    // when
    const config = createSisyphusAgent("openai/gpt-5.4");

    // then
    expect(config.prompt).toContain("Heidi Agent Capability Matrix");
    expect(config.prompt).toContain("Sisyphus");
    expect(config.prompt).toContain("Hephaestus");
    expect(config.prompt).toContain("Prometheus");
    expect(config.prompt).toContain("Atlas");
    expect(config.prompt).toContain("Default to delegation before acting directly on non-trivial work.");
    expect(config.prompt).toContain("After every delegation, verify the result before continuing or claiming completion.");
  });

  test("Hephaestus prompt includes explicit delegated-work verification", () => {
    // when
    const config = createHephaestusAgent("openai/gpt-5.4");

    // then
    expect(config.prompt).toContain("Heidi Agent Capability Matrix");
    expect(config.prompt).toContain("Hephaestus Prompt Invariants");
    expect(config.prompt).toContain("Delegate only to a clearly better specialist or to unlock parallel work");
    expect(config.prompt).toContain("If you delegate any portion, verify the delegated output before merging or reporting success.");
  });

  test("Prometheus prompt keeps planning-only handoff and verification invariants", () => {
    // when
    const prompt = getPrometheusPrompt("anthropic/claude-sonnet-4-6");

    // then
    expect(prompt).toContain("Heidi Agent Capability Matrix");
    expect(prompt).toContain("Prometheus Prompt Invariants");
    expect(prompt).toContain("Do not implement code or perform code-edit execution steps.");
    expect(prompt).toContain("Verify that the delegation target and handoff package are explicit before concluding.");
  });

  test("Atlas prompt verifies delegated outcomes before task closure", () => {
    // when
    const config = createAtlasAgent({ model: "openai/gpt-5.4" });

    // then
    expect(config.prompt).toContain("Heidi Agent Capability Matrix");
    expect(config.prompt).toContain("Atlas Prompt Invariants");
    expect(config.prompt).toContain("Sisyphus");
    expect(config.prompt).toContain("Hephaestus");
    expect(config.prompt).toContain("Prometheus");
    expect(config.prompt).toContain("Verify each delegated outcome before closing the corresponding task.");
  });
});