import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";
import { isInPreservedRegion, matchCase } from "./StageUtils.js";
import { buildWordBoundaryRegex } from "../../language/WordBoundary.js";

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

    const sorted = [...substitutions.entries()].sort(
      (a, b) => b[0].length - a[0].length
    );

    const { script } = options.dictionary;

    for (const [phrase, replacement] of sorted) {
      const pattern = buildWordBoundaryRegex(phrase, script);

      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }

        const caseAdjusted = matchCase(matched, replacement);

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

    const { script } = options.dictionary;

    for (const [word, abbr] of sorted) {
      const pattern = buildWordBoundaryRegex(word, script);

      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }

        if (this.isPartOfIdentifier(result, offset, matched.length)) {
          return matched;
        }

        const caseAdjusted = matchCase(matched, abbr);

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

    if (charBefore && /[a-z]/.test(charBefore) && /[A-Z]/.test(text[offset])) {
      return true;
    }

    return false;
  }
}
