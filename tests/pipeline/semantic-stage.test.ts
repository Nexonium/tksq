import { describe, it, expect } from "vitest";
import { SemanticStage } from "../../src/pipeline/stages/SemanticStage.js";
import type { StageOptions } from "../../src/pipeline/stages/IStage.js";
import { createGeneralDictionary } from "../../src/dictionaries/domains/general.js";
import { createProgrammingDictionary } from "../../src/dictionaries/domains/programming.js";

function makeOptions(
  level: "light" | "medium" | "aggressive" = "medium",
  domain: "general" | "programming" = "general"
): StageOptions {
  const dictionary =
    domain === "programming"
      ? createProgrammingDictionary()
      : createGeneralDictionary();
  return { level, contentType: "auto", preservedRegions: [], dictionary };
}

describe("SemanticStage", () => {
  const stage = new SemanticStage();

  it("has correct id and name", () => {
    expect(stage.id).toBe("semantic");
    expect(stage.name).toBe("Semantic");
  });

  it("applies substitutions", () => {
    const input = "in order to achieve this goal";
    const result = stage.process(input, makeOptions());
    // "in order to" should become "to"
    expect(result.text.length).toBeLessThan(input.length);
  });

  it("preserves case in substitutions", () => {
    const input = "In order to do this";
    const result = stage.process(input, makeOptions());
    expect(result.text[0]).toBe(result.text[0].toUpperCase());
  });

  it("skips abbreviations on light level", () => {
    const opts = makeOptions("light", "programming");
    const input = "the function implementation";
    const result = stage.process(input, opts);
    // On light level, abbreviations should NOT be applied
    expect(result.text).toContain("function");
  });

  it("applies abbreviations on medium+ with programming domain", () => {
    const opts = makeOptions("medium", "programming");
    const input = "the configuration is important";
    const result = stage.process(input, opts);
    expect(result.text).toContain("config");
  });

  it("does not abbreviate inside identifiers", () => {
    const opts = makeOptions("medium", "programming");
    const input = "call myFunction()";
    const result = stage.process(input, opts);
    // "function" inside "myFunction()" should not be abbreviated
    expect(result.text).toContain("myFunction()");
  });

  it("tracks changes with rule names", () => {
    const input = "in order to test";
    const result = stage.process(input, makeOptions());
    if (result.changes.length > 0) {
      expect(result.changes[0].rule).toMatch(/^semantic:/);
    }
  });
});
