import { describe, it, expect, beforeEach, vi } from "vitest";
import { PhraseStore } from "../../src/learning/PhraseStore.js";

// Mock fs to avoid actual file I/O in tests
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("PhraseStore", () => {
  let store: PhraseStore;

  beforeEach(() => {
    store = new PhraseStore();
  });

  it("loads empty data when no file exists", async () => {
    const data = await store.getCandidates();
    expect(data).toEqual([]);
  });

  it("adds a candidate and retrieves it", async () => {
    await store.addCandidate("test phrase", "TP", 100);
    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].phrase).toBe("test phrase");
    expect(candidates[0].suggestedReplacement).toBe("TP");
    expect(candidates[0].count).toBe(1);
  });

  it("increments candidate count on duplicate add", async () => {
    await store.addCandidate("test phrase", null, 100);
    await store.addCandidate("test phrase", "TP", 100);
    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].count).toBe(2);
    expect(candidates[0].suggestedReplacement).toBe("TP");
  });

  it("incrementCandidate increases count for existing", async () => {
    await store.addCandidate("hello world", "HW", 100);
    await store.incrementCandidate("hello world");
    const candidates = await store.getCandidates();
    expect(candidates[0].count).toBe(2);
  });

  it("incrementCandidate does nothing for non-existing", async () => {
    await store.incrementCandidate("nonexistent");
    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(0);
  });

  it("promotes a candidate to active pattern", async () => {
    await store.addCandidate("test phrase", "TP", 100);
    await store.promote("test phrase", "TP");

    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(0);

    const promoted = await store.getPromoted();
    expect(promoted["test phrase"]).toBe("TP");
  });

  it("rejects a candidate", async () => {
    await store.addCandidate("bad phrase", "BP", 100);
    const removed = await store.reject("bad phrase");
    expect(removed).toBe(true);

    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(0);
  });

  it("reject returns false for non-existing candidate", async () => {
    const removed = await store.reject("nonexistent");
    expect(removed).toBe(false);
  });

  it("getReadyCandidates filters by minFrequency", async () => {
    await store.addCandidate("phrase a", "PA", 100);
    // Add 4 more times to reach count=5
    for (let i = 0; i < 4; i++) {
      await store.addCandidate("phrase a", null, 100);
    }
    await store.addCandidate("phrase b", "PB", 100);

    const ready = await store.getReadyCandidates(5);
    expect(ready.length).toBe(1);
    expect(ready[0].phrase).toBe("phrase a");
  });

  it("getReadyCandidates excludes candidates without replacement", async () => {
    await store.addCandidate("no replacement", null, 100);
    for (let i = 0; i < 5; i++) {
      await store.addCandidate("no replacement", null, 100);
    }

    const ready = await store.getReadyCandidates(5);
    expect(ready.length).toBe(0);
  });

  it("tracks compression stats", async () => {
    await store.updateStats(50, 1000, 800);
    await store.updateStats(30, 500, 400);

    const stats = await store.getStats();
    expect(stats.totalCompressions).toBe(2);
    expect(stats.totalTokensSaved).toBe(80);
    expect(stats.totalCharsOriginal).toBe(1500);
    expect(stats.totalCharsCompressed).toBe(1200);
  });

  it("increments session count", async () => {
    await store.incrementSessionCount();
    await store.incrementSessionCount();

    const stats = await store.getStats();
    expect(stats.sessionCount).toBe(2);
  });

  it("resets all data", async () => {
    await store.addCandidate("phrase", "P", 100);
    await store.promote("phrase", "P");
    await store.updateStats(10, 100, 90);
    await store.incrementSessionCount();

    await store.reset();

    const candidates = await store.getCandidates();
    const promoted = await store.getPromoted();
    const stats = await store.getStats();

    expect(candidates.length).toBe(0);
    expect(Object.keys(promoted).length).toBe(0);
    expect(stats.totalCompressions).toBe(0);
    expect(stats.sessionCount).toBe(0);
  });

  it("evicts lowest-frequency candidates when maxCandidates exceeded", async () => {
    const maxCandidates = 3;

    await store.addCandidate("phrase a", "PA", maxCandidates);
    await store.addCandidate("phrase a", null, maxCandidates); // count=2

    await store.addCandidate("phrase b", "PB", maxCandidates);
    await store.addCandidate("phrase b", null, maxCandidates);
    await store.addCandidate("phrase b", null, maxCandidates); // count=3

    await store.addCandidate("phrase c", "PC", maxCandidates); // count=1

    await store.addCandidate("phrase d", "PD", maxCandidates); // count=1, triggers eviction

    const candidates = await store.getCandidates();
    // Should keep top 3 by count: phrase b (3), phrase a (2), and one of c/d (1)
    expect(candidates.length).toBe(maxCandidates);
    expect(candidates[0].phrase).toBe("phrase b"); // highest count
    expect(candidates[1].phrase).toBe("phrase a"); // second highest
  });

  it("candidates are sorted by count descending", async () => {
    await store.addCandidate("low", "L", 100);

    await store.addCandidate("high", "H", 100);
    await store.addCandidate("high", null, 100);
    await store.addCandidate("high", null, 100);

    await store.addCandidate("mid", "M", 100);
    await store.addCandidate("mid", null, 100);

    const candidates = await store.getCandidates();
    expect(candidates[0].phrase).toBe("high");
    expect(candidates[1].phrase).toBe("mid");
    expect(candidates[2].phrase).toBe("low");
  });

  it("is case-insensitive for keys", async () => {
    await store.addCandidate("Test Phrase", "TP", 100);
    await store.addCandidate("test phrase", null, 100);

    const candidates = await store.getCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].count).toBe(2);
  });
});
