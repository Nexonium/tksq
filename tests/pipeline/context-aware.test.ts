import { describe, it, expect } from "vitest";
import { CleanupStage } from "../../src/pipeline/stages/CleanupStage.js";
import { SemanticStage } from "../../src/pipeline/stages/SemanticStage.js";
import { StructuralStage } from "../../src/pipeline/stages/StructuralStage.js";
import { ShorthandStage } from "../../src/pipeline/stages/ShorthandStage.js";
import type { StageOptions, ContentType } from "../../src/pipeline/stages/IStage.js";
import { DictionaryLoader } from "../../src/dictionaries/DictionaryLoader.js";

function makeOptions(
  contentType: ContentType,
  level: "light" | "medium" | "aggressive" = "aggressive"
): StageOptions {
  return {
    level,
    contentType,
    preservedRegions: [],
    dictionary: DictionaryLoader.load("general", "en"),
  };
}

describe("Context-aware compression", () => {
  describe("code context", () => {
    const cleanup = new CleanupStage();
    const semantic = new SemanticStage();
    const structural = new StructuralStage();
    const shorthand = new ShorthandStage();

    it("cleanup skips filler removal for code", () => {
      const input = "needless to say, the function works";
      const autoResult = cleanup.process(input, makeOptions("auto", "medium"));
      const codeResult = cleanup.process(input, makeOptions("code", "medium"));
      // Auto removes fillers, code preserves them
      expect(autoResult.text).not.toContain("needless to say");
      expect(codeResult.text).toContain("needless to say");
    });

    it("semantic skips abbreviations for code", () => {
      const input = "the configuration is important";
      const proseResult = semantic.process(input, makeOptions("prose", "medium"));
      const codeResult = semantic.process(input, makeOptions("code", "medium"));
      // Prose abbreviates, code does not
      expect(codeResult.text).toContain("configuration");
    });

    it("structural skips dedup for code", () => {
      const input = "console.log(x);\nconsole.log(x);";
      const autoResult = structural.process(input, makeOptions("auto"));
      const codeResult = structural.process(input, makeOptions("code"));
      // Auto deduplicates, code preserves duplicate lines
      expect(autoResult.text.split("\n").filter((l) => l.trim() !== "")).toHaveLength(1);
      expect(codeResult.text.split("\n").filter((l) => l.trim() !== "")).toHaveLength(2);
    });

    it("structural skips collapse-repeat for code", () => {
      const input = "very very important";
      const codeResult = structural.process(input, makeOptions("code"));
      expect(codeResult.text).toBe("very very important");
    });

    it("shorthand skips contractions for code", () => {
      const input = "I do not think this will not work";
      const codeResult = shorthand.process(input, makeOptions("code"));
      expect(codeResult.text).toContain("do not");
    });
  });

  describe("structured context", () => {
    const cleanup = new CleanupStage();
    const semantic = new SemanticStage();
    const shorthand = new ShorthandStage();

    it("cleanup skips filler removal for structured", () => {
      const input = "needless to say, the data is valid";
      const structuredResult = cleanup.process(input, makeOptions("structured", "medium"));
      expect(structuredResult.text).toContain("needless to say");
    });

    it("semantic skips substitutions for structured", () => {
      const input = "in order to achieve this";
      const autoResult = semantic.process(input, makeOptions("auto", "medium"));
      const structuredResult = semantic.process(input, makeOptions("structured", "medium"));
      // Auto substitutes "in order to" -> "to", structured preserves
      expect(autoResult.text.length).toBeLessThan(input.length);
      expect(structuredResult.text).toBe(input);
    });

    it("shorthand skips all transforms for structured", () => {
      const input = "I do not think the system is ready";
      const structuredResult = shorthand.process(input, makeOptions("structured"));
      expect(structuredResult.text).toBe(input);
    });
  });

  describe("prose context", () => {
    const shorthand = new ShorthandStage();

    it("shorthand applies contractions for prose", () => {
      const input = "I do not think this will not work";
      const result = shorthand.process(input, makeOptions("prose"));
      expect(result.text).toContain("don't");
      expect(result.text).toContain("won't");
    });

    it("shorthand applies copulas for prose on aggressive", () => {
      const input = "It is important to note that this matters";
      const result = shorthand.process(input, makeOptions("prose", "aggressive"));
      expect(result.text).not.toContain("It is important to note that");
    });
  });

  describe("auto context behaves like default", () => {
    const structural = new StructuralStage();
    const shorthand = new ShorthandStage();

    it("auto deduplicates like prose", () => {
      const input = "Same line.\nSame line.";
      const result = structural.process(input, makeOptions("auto"));
      expect(result.text.split("\n").filter((l) => l.trim() !== "")).toHaveLength(1);
    });

    it("auto applies contractions", () => {
      const input = "I do not think so";
      const result = shorthand.process(input, makeOptions("auto"));
      expect(result.text).toContain("don't");
    });
  });
});
