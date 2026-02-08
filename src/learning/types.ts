export interface CandidatePattern {
  phrase: string;
  suggestedReplacement: string | null;
  count: number;
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
}

export interface LearnedData {
  version: number;
  candidates: Record<string, CandidatePattern>;
  promoted: Record<string, string>; // phrase -> replacement
  stats: CompressionStats;
}

export interface CompressionStats {
  totalCompressions: number;
  totalTokensSaved: number;
  totalCharsOriginal: number;
  totalCharsCompressed: number;
  sessionCount: number;
}

export interface LearningConfig {
  enabled: boolean;
  minFrequency: number;
  autoPromote: boolean;
  maxCandidates: number;
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  enabled: true,
  minFrequency: 5,
  autoPromote: false,
  maxCandidates: 100,
};

export const EMPTY_LEARNED_DATA: LearnedData = {
  version: 1,
  candidates: {},
  promoted: {},
  stats: {
    totalCompressions: 0,
    totalTokensSaved: 0,
    totalCharsOriginal: 0,
    totalCharsCompressed: 0,
    sessionCount: 0,
  },
};
