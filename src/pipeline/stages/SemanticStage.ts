import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";

export class SemanticStage implements ICompressionStage {
  readonly id = "semantic";
  readonly name = "Semantic";

  process(text: string, options: StageOptions): StageResult {
    const changes: Change[] = [];
    let result = text;

    result = this.applySubstitutions(result, options, changes);

    if (options.level !== "light") {
      result = this.applyAbbreviations(result, options, changes);
    }

    return { text: result, changes };
  }

  private applySubstitutions(
    text: string,
    options: StageOptions,
    changes: Change[]
  ): string {
    let result = text;
    const { substitutions } = options.dictionary;

    // Sort entries by key length descending (match longer phrases first)
    const sorted = [...substitutions.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [phrase, replacement] of sorted) {
      const escaped = this.escapeRegex(phrase);
      const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

      result = result.replace(pattern, (matched, offset: number) => {
        if (this.isInPreservedRegion(offset, result)) {
          return matched;
        }

        const caseAdjusted = this.matchCase(matched, replacement);

        changes.push({
          original: matched,
          replacement: caseAdjusted,
          position: offset,
          rule: "semantic:substitution",
        });

        return caseAdjusted;
      });
    }

    return result;
  }

  private applyAbbreviations(
    text: string,
    options: StageOptions,
    changes: Change[]
  ): string {
    let result = text;
    const { abbreviations } = options.dictionary;

    if (abbreviations.size === 0) return result;

    const sorted = [...abbreviations.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [word, abbr] of sorted) {
      const escaped = this.escapeRegex(word);
      const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

      result = result.replace(pattern, (matched, offset: number) => {
        if (this.isInPreservedRegion(offset, result)) {
          return matched;
        }

        if (this.isPartOfIdentifier(result, offset, matched.length)) {
          return matched;
        }

        const caseAdjusted = this.matchCase(matched, abbr);

        changes.push({
          original: matched,
          replacement: caseAdjusted,
          position: offset,
          rule: "semantic:abbreviation",
        });

        return caseAdjusted;
      });
    }

    return result;
  }

  private isPartOfIdentifier(
    text: string,
    offset: number,
    length: number
  ): boolean {
    const charBefore = offset > 0 ? text[offset - 1] : "";
    const charAfter =
      offset + length < text.length ? text[offset + length] : "";

    if (charBefore === "_" || charBefore === ".") return true;
    if (charAfter === "_" || charAfter === "(") return true;

    // camelCase detection
    if (charBefore && /[a-z]/.test(charBefore) && /[A-Z]/.test(text[offset])) {
      return true;
    }

    return false;
  }

  private matchCase(original: string, replacement: string): string {
    if (original === original.toUpperCase() && original.length > 1) {
      return replacement.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase() && original.length > 1) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  private isInPreservedRegion(position: number, text: string): boolean {
    const placeholderPattern = /\x00TKSQ_\d+\x00/g;
    let match: RegExpExecArray | null;
    while ((match = placeholderPattern.exec(text)) !== null) {
      if (position >= match.index && position < match.index + match[0].length) {
        return true;
      }
    }
    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
