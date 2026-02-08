import type { LanguageCode } from "../dictionaries/languages/types.js";

/**
 * Script-based language detection. No external dependencies.
 * Analyzes Unicode block distribution in a text sample.
 */
export class LanguageDetector {
  private static readonly SAMPLE_SIZE = 2000;
  private static readonly CYRILLIC_THRESHOLD = 0.3;

  static detect(text: string): LanguageCode {
    const sample = text.slice(0, LanguageDetector.SAMPLE_SIZE);

    const cyrillicCount = (sample.match(/[\u0400-\u04FF]/g) || []).length;
    const totalLetters = (sample.match(/\p{L}/gu) || []).length;

    if (totalLetters === 0) return "en";
    if (cyrillicCount / totalLetters > LanguageDetector.CYRILLIC_THRESHOLD) {
      return "ru";
    }

    return "en";
  }
}
