import { describe, it, expect } from "vitest";
import { DictionaryLoader } from "../../src/dictionaries/DictionaryLoader.js";

describe("DictionaryLoader", () => {
  it("loads general dictionary", () => {
    const dict = DictionaryLoader.load("general");
    expect(dict.fillers.length).toBeGreaterThan(0);
    expect(dict.substitutions.size).toBeGreaterThan(0);
    expect(dict.redundancies.length).toBeGreaterThan(0);
    expect(dict.abbreviations.size).toBe(0);
  });

  it("loads programming dictionary with abbreviations", () => {
    const dict = DictionaryLoader.load("programming");
    expect(dict.abbreviations.size).toBeGreaterThan(0);
    expect(dict.abbreviations.get("function")).toBe("fn");
    expect(dict.abbreviations.get("configuration")).toBe("config");
  });

  it("loads legal dictionary", () => {
    const dict = DictionaryLoader.load("legal");
    expect(dict.abbreviations.size).toBeGreaterThan(0);
    expect(dict.substitutions.has("in accordance with")).toBe(true);
  });

  it("loads academic dictionary", () => {
    const dict = DictionaryLoader.load("academic");
    expect(dict.abbreviations.size).toBeGreaterThan(0);
    expect(dict.substitutions.has("the results indicate that")).toBe(true);
  });

  it("lists all available domains", () => {
    const domains = DictionaryLoader.availableDomains();
    expect(domains).toContain("general");
    expect(domains).toContain("programming");
    expect(domains).toContain("legal");
    expect(domains).toContain("academic");
  });

  it("applies custom substitutions", () => {
    const dict = DictionaryLoader.load("general", "en", {
      "my custom phrase": "MCP",
    });
    expect(dict.substitutions.get("my custom phrase")).toBe("MCP");
  });

  it("throws on unknown domain", () => {
    expect(() => DictionaryLoader.load("unknown" as any)).toThrow(
      "Unknown domain"
    );
  });
});
