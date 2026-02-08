import { describe, it, expect } from "vitest";
import {
  buildWordBoundaryRegex,
  buildBoundaryPattern,
} from "../../src/language/WordBoundary.js";

describe("WordBoundary", () => {
  describe("buildBoundaryPattern", () => {
    it("uses \\b for latin script", () => {
      const pattern = buildBoundaryPattern("hello", "latin");
      expect(pattern).toBe("\\bhello\\b");
    });

    it("uses Unicode lookbehind/lookahead for cyrillic", () => {
      const pattern = buildBoundaryPattern("привет", "cyrillic");
      expect(pattern).toContain("\\p{L}");
      expect(pattern).toContain("привет");
    });
  });

  describe("buildWordBoundaryRegex", () => {
    it("matches Latin words at boundaries", () => {
      const regex = buildWordBoundaryRegex("hello", "latin");
      expect("say hello world".match(regex)).toBeTruthy();
      expect("helloworld".match(regex)).toBeNull();
    });

    it("matches Cyrillic words at boundaries", () => {
      const regex = buildWordBoundaryRegex("привет", "cyrillic");
      expect("скажи привет миру".match(regex)).toBeTruthy();
    });

    it("does not match Cyrillic word inside another word", () => {
      const regex = buildWordBoundaryRegex("при", "cyrillic");
      expect("привет".match(regex)).toBeNull();
    });

    it("is case-insensitive by default", () => {
      const regex = buildWordBoundaryRegex("Hello", "latin");
      expect("say hello".match(regex)).toBeTruthy();
    });

    it("adds u flag for cyrillic automatically", () => {
      const regex = buildWordBoundaryRegex("тест", "cyrillic", "gi");
      expect(regex.flags).toContain("u");
    });

    it("escapes special regex characters without throwing", () => {
      // Should not throw on special regex chars like +, ., (, etc.
      expect(() => buildWordBoundaryRegex("c++", "latin")).not.toThrow();
      expect(() => buildWordBoundaryRegex("file.txt", "latin")).not.toThrow();
      expect(() => buildWordBoundaryRegex("(test)", "latin")).not.toThrow();
      // Verify the regex is valid and can execute
      const regex = buildWordBoundaryRegex("test", "latin");
      expect(regex).toBeInstanceOf(RegExp);
    });
  });
});
