import type {
  CompressionLevel,
  TokenizerType,
} from "../pipeline/stages/IStage.js";
import type { DomainName } from "../dictionaries/DictionaryLoader.js";
import type { LanguageCode } from "../dictionaries/languages/types.js";
import type { LearningConfig } from "../learning/types.js";
import { DEFAULT_LEARNING_CONFIG } from "../learning/types.js";

export type LanguageSetting = LanguageCode | "auto";

export interface TksqConfig {
  level: CompressionLevel;
  tokenizer: TokenizerType;
  domain: DomainName;
  language: LanguageSetting;
  preservePatterns: string[];
  customSubstitutions: Record<string, string>;
  learning: LearningConfig;
}

export const DEFAULT_CONFIG: TksqConfig = {
  level: "medium",
  tokenizer: "cl100k_base",
  domain: "general",
  language: "auto",
  preservePatterns: [],
  customSubstitutions: {},
  learning: { ...DEFAULT_LEARNING_CONFIG },
};
