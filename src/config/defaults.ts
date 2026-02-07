import type {
  CompressionLevel,
  TokenizerType,
} from "../pipeline/stages/IStage.js";
import type { DomainName } from "../dictionaries/DictionaryLoader.js";

export interface TksqConfig {
  level: CompressionLevel;
  tokenizer: TokenizerType;
  domain: DomainName;
  preservePatterns: string[];
  customSubstitutions: Record<string, string>;
}

export const DEFAULT_CONFIG: TksqConfig = {
  level: "medium",
  tokenizer: "cl100k_base",
  domain: "general",
  preservePatterns: [],
  customSubstitutions: {},
};
