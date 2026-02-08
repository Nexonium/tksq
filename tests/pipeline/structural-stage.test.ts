import { describe, it, expect } from "vitest";
import { StructuralStage } from "../../src/pipeline/stages/StructuralStage.js";
import type { StageOptions } from "../../src/pipeline/stages/IStage.js";
import { createGeneralDictionary } from "../../src/dictionaries/domains/general.js";

function makeOptions(level: "light" | "medium" | "aggressive" = "aggressive"): StageOptions {
  return {
    level,
    preservedRegions: [],
    dictionary: createGeneralDictionary(),
  };
}

describe("StructuralStage", () => {
  const stage = new StructuralStage();

  it("has correct id and name", () => {
    expect(stage.id).toBe("structural");
    expect(stage.name).toBe("Structural");
  });

  it("deduplicates exact duplicate lines", () => {
    const input = "This is a test.\nThis is a test.\nAnother line.";
    const result = stage.process(input, makeOptions());
    const lines = result.text.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("This is a test.");
    expect(lines[1]).toBe("Another line.");
  });

  it("deduplication is case-insensitive", () => {
    const input = "Hello world.\nhello World.\nDifferent.";
    const result = stage.process(input, makeOptions());
    const lines = result.text.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(2);
  });

  it("collapses repeated consecutive words", () => {
    const input = "very very very important";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("very important");
  });

  it("keeps non-repeated words intact", () => {
    const input = "this is fine";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("this is fine");
  });

  it("does not condense short lists on medium", () => {
    const input = "a, b, c";
    const result = stage.process(input, makeOptions("medium"));
    expect(result.text).toBe("a, b, c");
  });

  it("condenses long lists on aggressive", () => {
    const input = "item1, item2, item3, item4, item5, item6";
    const result = stage.process(input, makeOptions("aggressive"));
    expect(result.text).toContain(";");
  });

  it("tracks changes", () => {
    const input = "Duplicate line.\nDuplicate line.";
    const result = stage.process(input, makeOptions());
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0].rule).toBe("structural:dedup-sentence");
  });
});
