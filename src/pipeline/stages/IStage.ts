export type CompressionLevel = "light" | "medium" | "aggressive";

export type ContentType = "code" | "prose" | "structured" | "auto";

export interface Change {
  original: string;
  replacement: string;
  position: number;
  rule: string;
}

export interface StageResult {
  text: string;
  changes: Change[];
}

export interface PreservedRegion {
  start: number;
  end: number;
  placeholder: string;
  originalText: string;
}

export interface StageOptions {
  level: CompressionLevel;
  preservedRegions: PreservedRegion[];
  dictionary: SubstitutionDictionary;
}

export interface ICompressionStage {
  readonly id: string;
  readonly name: string;
  process(text: string, options: StageOptions): StageResult;
}

export interface SubstitutionDictionary {
  fillers: string[];
  substitutions: Map<string, string>;
  redundancies: Array<{
    pattern: RegExp;
    replacement: string;
  }>;
  abbreviations: Map<string, string>;
}

export interface StageStats {
  stage: string;
  tokensIn: number;
  tokensOut: number;
  reductionPercent: number;
  timeMs: number;
}

export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  originalChars: number;
  compressedChars: number;
  stageBreakdown: StageStats[];
  tokenizer: string;
}

export interface PipelineConfig {
  level: CompressionLevel;
  stages?: string[];
  preservePatterns: RegExp[];
  tokenizer: TokenizerType;
  dictionary: SubstitutionDictionary;
}

export interface PipelineResult {
  compressed: string;
  stats: CompressionStats;
  allChanges: Change[];
}

export type TokenizerType = "cl100k_base" | "o200k_base" | "approximate";
