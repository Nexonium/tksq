import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";
import { isInPreservedRegion } from "./StageUtils.js";

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bdo not\b/gi, "don't"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bwill have\b/gi, "will've"],
  [/\bwould have\b/gi, "would've"],
  [/\bcould have\b/gi, "could've"],
  [/\bshould have\b/gi, "should've"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bthere is\b/gi, "there's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bwho is\b/gi, "who's"],
  [/\blet us\b/gi, "let's"],
  [/\bI am\b/g, "I'm"],
  [/\bI have\b/g, "I've"],
  [/\bI will\b/g, "I'll"],
  [/\bI would\b/g, "I'd"],
  [/\byou are\b/gi, "you're"],
  [/\byou have\b/gi, "you've"],
  [/\byou will\b/gi, "you'll"],
  [/\byou would\b/gi, "you'd"],
  [/\bwe are\b/gi, "we're"],
  [/\bwe have\b/gi, "we've"],
  [/\bwe will\b/gi, "we'll"],
  [/\bthey are\b/gi, "they're"],
  [/\bthey have\b/gi, "they've"],
  [/\bthey will\b/gi, "they'll"],
];

// Articles to remove in aggressive mode (only when surrounded by word boundaries)
const ARTICLE_PATTERN = /\b(the|a|an)\s+/gi;

// Copula simplifications (aggressive)
const COPULA_PATTERNS: Array<[RegExp, string]> = [
  [/\bit is important to note that\b/gi, "notably"],
  [/\bit is worth noting that\b/gi, "notably"],
  [/\bit is necessary to\b/gi, "must"],
  [/\bit is possible to\b/gi, "can"],
  [/\bit is recommended to\b/gi, "should"],
  [/\bthere are many\b/gi, "many"],
  [/\bthere are several\b/gi, "several"],
  [/\bthere are some\b/gi, "some"],
  [/\bthere is a need to\b/gi, "need to"],
];

export class ShorthandStage implements ICompressionStage {
  readonly id = "shorthand";
  readonly name = "Shorthand";

  process(text: string, options: StageOptions): StageResult {
    const changes: Change[] = [];
    let result = text;

    if (options.level === "aggressive") {
      // Copulas must run before contractions to match "it is ..." patterns
      result = this.simplifyCopulas(result, changes);
      result = this.removeArticles(result, changes);
    }

    result = this.applyContractions(result, changes);

    return { text: result, changes };
  }

  private applyContractions(text: string, changes: Change[]): string {
    let result = text;

    for (const [pattern, replacement] of CONTRACTIONS) {
      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }

        // Preserve case of first letter
        const contracted =
          matched[0] === matched[0].toUpperCase()
            ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
            : replacement;

        changes.push({
          original: matched,
          replacement: contracted,
          position: offset,
          rule: "shorthand:contraction",
        });

        return contracted;
      });
    }

    return result;
  }

  private simplifyCopulas(text: string, changes: Change[]): string {
    let result = text;

    for (const [pattern, replacement] of COPULA_PATTERNS) {
      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }

        changes.push({
          original: matched,
          replacement,
          position: offset,
          rule: "shorthand:copula",
        });

        return replacement;
      });
    }

    return result;
  }

  private removeArticles(text: string, changes: Change[]): string {
    let result = text;

    result = result.replace(ARTICLE_PATTERN, (matched, _article: string, offset: number) => {
      if (isInPreservedRegion(offset, result)) {
        return matched;
      }

      // Don't remove articles at the start of sentences (after period + space or start of line)
      const charBefore = offset > 0 ? result[offset - 1] : "\n";
      if (charBefore === "." || charBefore === "\n" || offset === 0) {
        return matched;
      }

      changes.push({
        original: matched.trim(),
        replacement: "",
        position: offset,
        rule: "shorthand:article",
      });

      return "";
    });

    return result;
  }
}
