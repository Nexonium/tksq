export type LanguageCode = "en" | "ru";

export type ScriptType = "latin" | "cyrillic";

export interface ShorthandConfig {
  contractions: Array<[RegExp, string]>;
  articles: RegExp | null;
  copulas: Array<[RegExp, string]>;
}

export interface LanguagePack {
  readonly code: LanguageCode;
  readonly script: ScriptType;

  readonly fillers: string[];
  readonly substitutions: Array<[string, string]>;
  readonly redundancies: Array<{ pattern: RegExp; replacement: string }>;

  readonly shorthand: ShorthandConfig;

  // Regex for capitalize-after-period (language-specific letter ranges)
  readonly capitalizeAfterPeriod: RegExp;
}
