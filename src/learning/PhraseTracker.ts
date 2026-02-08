import type { PhraseStore } from "./PhraseStore.js";
import type { LearningConfig } from "./types.js";

interface PhraseOccurrence {
  phrase: string;
  count: number;
}

export class PhraseTracker {
  private sessionFrequencies = new Map<string, number>();

  constructor(
    private readonly store: PhraseStore,
    private readonly config: LearningConfig
  ) {}

  async analyzeText(text: string): Promise<PhraseOccurrence[]> {
    if (!this.config.enabled) return [];

    const phrases = this.extractRepeatingPhrases(text);
    const newCandidates: PhraseOccurrence[] = [];

    for (const { phrase, count } of phrases) {
      const key = phrase.toLowerCase();

      const sessionCount = (this.sessionFrequencies.get(key) ?? 0) + count;
      this.sessionFrequencies.set(key, sessionCount);

      await this.store.addCandidate(
        phrase,
        this.suggestReplacement(phrase),
        this.config.maxCandidates
      );

      newCandidates.push({ phrase, count: sessionCount });
    }

    if (this.config.autoPromote) {
      await this.autoPromoteReady();
    }

    return newCandidates;
  }

  async getReadySuggestions(): Promise<
    Array<{ phrase: string; replacement: string; count: number }>
  > {
    const ready = await this.store.getReadyCandidates(this.config.minFrequency);
    return ready
      .filter((c) => c.suggestedReplacement !== null)
      .map((c) => ({
        phrase: c.phrase,
        replacement: c.suggestedReplacement!,
        count: c.count,
      }));
  }

  private async autoPromoteReady(): Promise<void> {
    const ready = await this.store.getReadyCandidates(this.config.minFrequency);
    for (const candidate of ready) {
      if (candidate.suggestedReplacement) {
        await this.store.promote(
          candidate.phrase,
          candidate.suggestedReplacement
        );
      }
    }
  }

  private extractRepeatingPhrases(text: string): PhraseOccurrence[] {
    const words = text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length < 4) return [];

    const phraseCounts = new Map<string, number>();

    // Extract n-grams (2-4 words) and count occurrences
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(" ");
        const key = ngram.toLowerCase();
        // Skip if too short (total chars)
        if (key.length < 8) continue;
        phraseCounts.set(key, (phraseCounts.get(key) ?? 0) + 1);
      }
    }

    // Only keep phrases appearing 2+ times within this text
    const results: PhraseOccurrence[] = [];
    for (const [phrase, count] of phraseCounts) {
      if (count >= 2) {
        results.push({ phrase, count });
      }
    }

    // Sort by count descending, take top candidates
    results.sort((a, b) => b.count - a.count);
    return results.slice(0, 20);
  }

  suggestReplacement(phrase: string): string | null {
    const words = phrase.split(/\s+/);

    // Acronym: if 2-5 words, try first letters
    if (words.length >= 2 && words.length <= 5) {
      const acronym = words.map((w) => w[0].toUpperCase()).join("");
      // Only suggest if significantly shorter
      if (acronym.length < phrase.length * 0.5) {
        return acronym;
      }
    }

    // Single long word: try common shortenings
    if (words.length === 1 && phrase.length >= 10) {
      const shortenings: Array<[RegExp, string]> = [
        [/configuration$/i, "config"],
        [/implementation$/i, "impl"],
        [/application$/i, "app"],
        [/documentation$/i, "docs"],
        [/information$/i, "info"],
        [/development$/i, "dev"],
        [/environment$/i, "env"],
        [/management$/i, "mgmt"],
        [/performance$/i, "perf"],
        [/repository$/i, "repo"],
      ];

      for (const [pattern, short] of shortenings) {
        if (pattern.test(phrase)) return short;
      }
    }

    return null;
  }
}
