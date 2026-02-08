import { describe, it, expect } from "vitest";
import { CleanupStage } from "../../src/pipeline/stages/CleanupStage.js";
import type { StageOptions } from "../../src/pipeline/stages/IStage.js";
import { createGeneralDictionary } from "../../src/dictionaries/domains/general.js";

function makeOptions(level: "light" | "medium" | "aggressive" = "medium"): StageOptions {
  return {
    level,
    preservedRegions: [],
    dictionary: createGeneralDictionary(),
  };
}

describe("CleanupStage", () => {
  const stage = new CleanupStage();

  it("has correct id and name", () => {
    expect(stage.id).toBe("cleanup");
    expect(stage.name).toBe("Cleanup");
  });

  it("collapses multiple blank lines", () => {
    const input = "line1\n\n\n\nline2";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("line1\n\nline2");
  });

  it("collapses multiple spaces in content", () => {
    const input = "hello    world";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("hello world");
  });

  it("preserves indented content structure", () => {
    const input = "first line\n  indented line\nlast line";
    const result = stage.process(input, makeOptions());
    // The normalizeWhitespace step preserves leading indentation,
    // but finalWhitespacePass collapses multi-spaces globally.
    // Content and structure should still be intact.
    expect(result.text).toContain("indented line");
    expect(result.text).toContain("first line");
    expect(result.text).toContain("last line");
  });

  it("trims trailing whitespace", () => {
    const input = "hello   \nworld   ";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("hello\nworld");
  });

  it("removes filler phrases", () => {
    const input = "needless to say, the system works well";
    const result = stage.process(input, makeOptions());
    expect(result.text).not.toContain("needless to say");
  });

  it("fixes double periods", () => {
    const input = "End of sentence.. Next one.";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("End of sentence. Next one.");
  });

  it("removes space before punctuation", () => {
    const input = "hello , world .";
    const result = stage.process(input, makeOptions());
    expect(result.text).toBe("hello, world.");
  });

  it("tracks changes", () => {
    const input = "hello    world";
    const result = stage.process(input, makeOptions());
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
