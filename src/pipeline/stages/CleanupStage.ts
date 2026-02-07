import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";
import { isInPreservedRegion, escapeRegex } from "./StageUtils.js";

export class CleanupStage implements ICompressionStage {
  readonly id = "cleanup";
  readonly name = "Cleanup";

  process(text: string, options: StageOptions): StageResult {
    const changes: Change[] = [];
    let result = text;

    result = this.normalizeWhitespace(result, changes);
    result = this.removeFillers(result, options, changes);
    result = this.removeRedundancies(result, options, changes);
    result = this.cleanupPunctuation(result, changes);
    result = this.finalWhitespacePass(result);

    return { text: result, changes };
  }

  private normalizeWhitespace(text: string, changes: Change[]): string {
    let result = text;

    // Collapse multiple blank lines into one
    const before1 = result;
    result = result.replace(/\n{3,}/g, "\n\n");
    if (before1 !== result) {
      changes.push({
        original: "(multiple blank lines)",
        replacement: "(single blank line)",
        position: 0,
        rule: "cleanup:blank-lines",
      });
    }

    // Collapse multiple spaces (preserve leading indentation)
    const lines = result.split("\n");
    const normalized = lines.map((line) => {
      const match = line.match(/^(\s*)(.*)/);
      if (!match) return line;
      const [, indent, content] = match;
      const collapsed = content.replace(/ {2,}/g, " ");
      return indent + collapsed;
    });
    const after = normalized.join("\n");
    if (after !== result) {
      changes.push({
        original: "(multiple spaces)",
        replacement: "(single space)",
        position: 0,
        rule: "cleanup:collapse-spaces",
      });
      result = after;
    }

    // Trim trailing whitespace per line
    const trimmed = result
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");
    if (trimmed !== result) {
      changes.push({
        original: "(trailing whitespace)",
        replacement: "(trimmed)",
        position: 0,
        rule: "cleanup:trim-trailing",
      });
      result = trimmed;
    }

    return result;
  }

  private removeFillers(
    text: string,
    options: StageOptions,
    changes: Change[]
  ): string {
    let result = text;
    const { fillers } = options.dictionary;

    // Sort fillers longest-first to avoid partial matches
    const sorted = [...fillers].sort((a, b) => b.length - a.length);

    for (const filler of sorted) {
      const escaped = escapeRegex(filler);
      const pattern = new RegExp(`\\b${escaped}\\b[,]?\\s*`, "gi");

      const matches = [...result.matchAll(new RegExp(pattern.source, pattern.flags))];
      for (const match of matches) {
        if (!isInPreservedRegion(match.index!, result)) {
          changes.push({
            original: match[0],
            replacement: "",
            position: match.index!,
            rule: "cleanup:filler",
          });
        }
      }

      result = result.replace(pattern, (matched, offset: number) => {
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }
        return "";
      });
    }

    return result;
  }

  private removeRedundancies(
    text: string,
    options: StageOptions,
    changes: Change[]
  ): string {
    let result = text;
    const { redundancies } = options.dictionary;

    for (const { pattern, replacement } of redundancies) {
      const regex = new RegExp(pattern.source, pattern.flags);

      const matches = [...result.matchAll(new RegExp(pattern.source, pattern.flags))];
      for (const match of matches) {
        if (!isInPreservedRegion(match.index!, result)) {
          changes.push({
            original: match[0],
            replacement,
            position: match.index!,
            rule: "cleanup:redundancy",
          });
        }
      }

      result = result.replace(regex, (matched, ...args) => {
        const offset = typeof args[args.length - 2] === "number" ? args[args.length - 2] : 0;
        if (isInPreservedRegion(offset, result)) {
          return matched;
        }
        return replacement;
      });
    }

    return result;
  }

  private cleanupPunctuation(text: string, changes: Change[]): string {
    let result = text;

    // Fix double periods
    const before1 = result;
    result = result.replace(/\.{2}(?!\.)/g, ".");
    if (result !== before1) {
      changes.push({ original: "..", replacement: ".", position: 0, rule: "cleanup:double-period" });
    }

    // Fix space before period/comma
    const before2 = result;
    result = result.replace(/ +([.,;:!?])/g, "$1");
    if (result !== before2) {
      changes.push({ original: "(space before punct)", replacement: "(removed)", position: 0, rule: "cleanup:space-before-punct" });
    }

    // Fix double commas
    const before3 = result;
    result = result.replace(/,\s*,/g, ",");
    if (result !== before3) {
      changes.push({ original: ",,", replacement: ",", position: 0, rule: "cleanup:double-comma" });
    }

    // Capitalize after period
    result = result.replace(/\.\s+([a-z])/g, (_match, letter: string) => {
      return ". " + letter.toUpperCase();
    });

    // Remove leading comma at start of line
    result = result.replace(/^\s*[,]\s*/gm, "");

    return result;
  }

  private finalWhitespacePass(text: string): string {
    let result = text;
    result = result.replace(/ {2,}/g, " ");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.trim();
    return result;
  }

}
