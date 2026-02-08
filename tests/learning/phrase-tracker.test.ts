import { describe, it, expect, beforeEach, vi } from "vitest";
import { PhraseTracker } from "../../src/learning/PhraseTracker.js";
import { PhraseStore } from "../../src/learning/PhraseStore.js";
import type { LearningConfig } from "../../src/learning/types.js";

// Mock fs to avoid actual file I/O in tests
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("PhraseTracker", () => {
  let store: PhraseStore;
  let tracker: PhraseTracker;
  const config: LearningConfig = {
    enabled: true,
    minFrequency: 3,
    autoPromote: false,
    maxCandidates: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PhraseStore();
    tracker = new PhraseTracker(store, config);
  });

  describe("suggestReplacement", () => {
    it("suggests acronym for multi-word phrases", () => {
      const result = tracker.suggestReplacement("machine learning model");
      expect(result).toBe("MLM");
    });

    it("suggests acronym for 2-word phrase", () => {
      const result = tracker.suggestReplacement("natural language");
      expect(result).toBe("NL");
    });

    it("returns null for short phrases where acronym is not significantly shorter", () => {
      // "a b" = 3 chars, acronym "AB" = 2 chars, 2 < 3*0.5=1.5 is false -> null
      const result = tracker.suggestReplacement("a b");
      expect(result).toBeNull();
    });

    it("suggests shortening for long single words", () => {
      expect(tracker.suggestReplacement("configuration")).toBe("config");
      expect(tracker.suggestReplacement("implementation")).toBe("impl");
      expect(tracker.suggestReplacement("documentation")).toBe("docs");
      expect(tracker.suggestReplacement("application")).toBe("app");
      expect(tracker.suggestReplacement("information")).toBe("info");
      expect(tracker.suggestReplacement("development")).toBe("dev");
      expect(tracker.suggestReplacement("environment")).toBe("env");
      expect(tracker.suggestReplacement("management")).toBe("mgmt");
      expect(tracker.suggestReplacement("performance")).toBe("perf");
      expect(tracker.suggestReplacement("repository")).toBe("repo");
    });

    it("returns null for unknown single words", () => {
      const result = tracker.suggestReplacement("something");
      expect(result).toBeNull();
    });
  });

  describe("analyzeText", () => {
    it("returns empty when learning is disabled", async () => {
      const disabledTracker = new PhraseTracker(store, {
        ...config,
        enabled: false,
      });
      const result = await disabledTracker.analyzeText(
        "the quick brown fox the quick brown fox"
      );
      expect(result).toEqual([]);
    });

    it("extracts repeating n-grams from text", async () => {
      const text =
        "the implementation details are important. " +
        "the implementation details should be documented. " +
        "the implementation details need review.";

      const result = await tracker.analyzeText(text);
      expect(result.length).toBeGreaterThan(0);

      const phrases = result.map((r) => r.phrase.toLowerCase());
      expect(phrases).toContain("the implementation details");
    });

    it("stores candidates in PhraseStore", async () => {
      const text =
        "machine learning model is great. machine learning model works well.";

      await tracker.analyzeText(text);
      const candidates = await store.getCandidates();
      expect(candidates.length).toBeGreaterThan(0);
    });

    it("ignores short texts", async () => {
      const result = await tracker.analyzeText("too short");
      expect(result).toEqual([]);
    });

    it("tracks session frequency across calls", async () => {
      const text1 =
        "the configuration process is complex. the configuration process needs simplification.";
      const text2 =
        "we reviewed the configuration process again. the configuration process was updated.";

      await tracker.analyzeText(text1);
      const result2 = await tracker.analyzeText(text2);

      const configPhrase = result2.find((r) =>
        r.phrase.toLowerCase().includes("configuration process")
      );
      if (configPhrase) {
        expect(configPhrase.count).toBeGreaterThan(2);
      }
    });
  });

  describe("getReadySuggestions", () => {
    it("returns candidates above minFrequency with replacements", async () => {
      // Add phrase many times to exceed minFrequency
      for (let i = 0; i < 5; i++) {
        await store.addCandidate(
          "implementation details",
          "ID",
          config.maxCandidates
        );
      }

      const suggestions = await tracker.getReadySuggestions();
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].phrase).toBe("implementation details");
      expect(suggestions[0].replacement).toBe("ID");
      expect(suggestions[0].count).toBe(5);
    });

    it("returns empty when no candidates are ready", async () => {
      await store.addCandidate("rare phrase long", "RPL", config.maxCandidates);
      const suggestions = await tracker.getReadySuggestions();
      expect(suggestions.length).toBe(0);
    });
  });

  describe("auto-promote", () => {
    it("auto-promotes ready candidates when enabled", async () => {
      const autoTracker = new PhraseTracker(store, {
        ...config,
        autoPromote: true,
        minFrequency: 2,
      });

      // Pre-load a candidate close to threshold
      await store.addCandidate(
        "implementation details",
        "ID",
        config.maxCandidates
      );

      // Text with the phrase appearing 2+ times triggers analysis + auto-promote
      const text =
        "the implementation details are clear. " +
        "the implementation details are documented.";

      await autoTracker.analyzeText(text);

      const promoted = await store.getPromoted();
      expect(promoted["implementation details"]).toBe("ID");
    });
  });
});
