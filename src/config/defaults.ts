import type {
  CompressionLevel,
  TokenizerType,
} from "../pipeline/stages/IStage.js";
import type { DomainName } from "../dictionaries/DictionaryLoader.js";
import type { LanguageCode } from "../dictionaries/languages/types.js";

export type LanguageSetting = LanguageCode | "auto";

export interface TksqConfig {
  level: CompressionLevel;
  tokenizer: TokenizerType;
  domain: DomainName;
  language: LanguageSetting;
  preservePatterns: string[];
  customSubstitutions: Record<string, string>;
}

export const DEFAULT_CONFIG: TksqConfig = {
  level: "medium",
  tokenizer: "cl100k_base",
  domain: "general",
  language: "auto",
  preservePatterns: [],
  customSubstitutions: {},
};
