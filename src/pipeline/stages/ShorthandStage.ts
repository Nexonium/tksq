import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";
import { isInPreservedRegion } from "./StageUtils.js";

export class ShorthandStage implements ICompressionStage {
  readonly id = "shorthand";
  readonly name = "Shorthand";

  process(text: string, options: StageOptions): StageResult {
    const changes: Change[] = [];
    let result = text;
    const { shorthand } = options.dictionary;

    if (options.level === "aggressive") {
      if (shorthand.copulas.length > 0) {
        result = this.simplifyCopulas(result, shorthand.copulas, changes);
      }
      if (shorthand.articles) {
        result = this.removeArticles(result, shorthand.articles, changes);
      }
    }

    if (shorthand.contractions.length > 0) {
      result = this.applyContractions(result, shorthand.contractions, changes);
    }

    return { text: result, changes };
  }

  private applyContractions(
    text: string,
    contractions: Array<[RegExp, string]>,
    changes: Change[]
  ): string {
    let result = text;

    for (const [pattern, replacement] of contractions) {
      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }

        const contracted =
          matched[0] !== matched[0].toLowerCase()
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

  private simplifyCopulas(
    text: string,
    copulas: Array<[RegExp, string]>,
    changes: Change[]
  ): string {
    let result = text;

    for (const [pattern, replacement] of copulas) {
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

  private removeArticles(
    text: string,
    articlePattern: RegExp,
    changes: Change[]
  ): string {
    let result = text;

    result = result.replace(articlePattern, (matched, _article: string, offset: number) => {
      if (isInPreservedRegion(offset, result)) {
        return matched;
      }

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
