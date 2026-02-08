import { describe, it, expect } from "vitest";
import { LanguageDetector } from "../../src/language/LanguageDetector.js";

describe("LanguageDetector", () => {
  it("detects English text", () => {
    const text = "This is a simple English sentence with some words.";
    expect(LanguageDetector.detect(text)).toBe("en");
  });

  it("detects Russian text", () => {
    const text = "Это простое предложение на русском языке с несколькими словами.";
    expect(LanguageDetector.detect(text)).toBe("ru");
  });

  it("defaults to English for empty text", () => {
    expect(LanguageDetector.detect("")).toBe("en");
  });

  it("defaults to English for numbers only", () => {
    expect(LanguageDetector.detect("12345 67890")).toBe("en");
  });

  it("detects Russian in mixed text with Cyrillic majority", () => {
    const text = "Мы используем JavaScript для разработки. Это важно.";
    expect(LanguageDetector.detect(text)).toBe("ru");
  });

  it("detects English in mixed text with Latin majority", () => {
    const text = "We use JavaScript for development. The word привет is Russian.";
    expect(LanguageDetector.detect(text)).toBe("en");
  });

  it("samples only first 2000 characters", () => {
    const russianPrefix = "Это текст. ".repeat(200);
    const englishSuffix = "This is text. ".repeat(500);
    expect(LanguageDetector.detect(russianPrefix + englishSuffix)).toBe("ru");
  });
});
