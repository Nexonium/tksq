import { describe, it, expect } from "vitest";
import { ShorthandStage } from "../../src/pipeline/stages/ShorthandStage.js";
import type { StageOptions } from "../../src/pipeline/stages/IStage.js";
import { DictionaryLoader } from "../../src/dictionaries/DictionaryLoader.js";

function makeOptions(level: "light" | "medium" | "aggressive" = "aggressive"): StageOptions {
  return {
    level,
    preservedRegions: [],
    dictionary: DictionaryLoader.load("general", "en"),
  };
}

describe("ShorthandStage", () => {
  const stage = new ShorthandStage();

  it("has correct id and name", () => {
    expect(stage.id).toBe("shorthand");
    expect(stage.name).toBe("Shorthand");
  });

  it("applies contractions", () => {
    const input = "I do not think this will not work";
    const result = stage.process(input, makeOptions());
    expect(result.text).toContain("don't");
    expect(result.text).toContain("won't");
  });

  it("preserves case in contractions", () => {
    const input = "Do not touch this";
    const result = stage.process(input, makeOptions());
    expect(result.text).toContain("Don't");
  });

  it("simplifies copulas on aggressive", () => {
    const input = "It is important to note that this matters";
    const result = stage.process(input, makeOptions("aggressive"));
    expect(result.text).not.toContain("It is important to note that");
    expect(result.text.toLowerCase()).toContain("notably");
  });

  it("does not simplify copulas on medium", () => {
    const input = "It is important to note that this matters";
    const result = stage.process(input, makeOptions("medium"));
    // Copulas only apply on aggressive, but contractions still apply
    expect(result.text).toContain("important to note");
  });

  it("removes articles on aggressive (mid-sentence)", () => {
    const input = "Give me the book and a pen";
    const result = stage.process(input, makeOptions("aggressive"));
    // Articles mid-sentence should be removed
    expect(result.text.split(" ").filter((w) => w === "the")).toHaveLength(0);
  });

  it("does not remove articles on medium", () => {
    const input = "Give me the book";
    const result = stage.process(input, makeOptions("medium"));
    expect(result.text).toContain("the");
  });

  it("tracks changes with rule names", () => {
    const input = "I do not know";
    const result = stage.process(input, makeOptions());
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0].rule).toBe("shorthand:contraction");
  });
});
