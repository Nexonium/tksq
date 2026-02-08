import type { LanguageCode, LanguagePack } from "./types.js";
import { englishPack } from "./en.js";
import { russianPack } from "./ru.js";

const LANGUAGE_PACKS: Record<LanguageCode, LanguagePack> = {
  en: englishPack,
  ru: russianPack,
};

export class LanguageRegistry {
  static get(code: LanguageCode): LanguagePack {
    const pack = LANGUAGE_PACKS[code];
    if (!pack) {
      const available = Object.keys(LANGUAGE_PACKS).join(", ");
      throw new Error(
        `Unknown language: ${code}. Available: ${available}`
      );
    }
    return pack;
  }

  static availableLanguages(): LanguageCode[] {
    return Object.keys(LANGUAGE_PACKS) as LanguageCode[];
  }
}
