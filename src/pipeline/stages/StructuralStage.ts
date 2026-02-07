import type {
  ICompressionStage,
  StageOptions,
  StageResult,
  Change,
} from "./IStage.js";
import { isInPreservedRegion } from "./StageUtils.js";

export class StructuralStage implements ICompressionStage {
  readonly id = "structural";
  readonly name = "Structural";

  process(text: string, options: StageOptions): StageResult {
    const changes: Change[] = [];
    let result = text;

    result = this.deduplicateSentences(result, changes);
    result = this.collapseRepeatedPhrases(result, changes);

    if (options.level === "aggressive") {
      result = this.condenseLists(result, changes);
    }

    return { text: result, changes };
  }

  private deduplicateSentences(text: string, changes: Change[]): string {
    const lines = text.split("\n");
    const seen = new Set<string>();
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and preserved regions
      if (trimmed === "") {
        result.push(line);
        continue;
      }

      if (isInPreservedRegion(text.indexOf(line), text)) {
        result.push(line);
        continue;
      }

      const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");

      if (seen.has(normalized)) {
        changes.push({
          original: trimmed,
          replacement: "",
          position: text.indexOf(line),
          rule: "structural:dedup-sentence",
        });
        continue;
      }

      seen.add(normalized);
      result.push(line);
    }

    return result.join("\n");
  }

  private collapseRepeatedPhrases(text: string, changes: Change[]): string {
    let result = text;

    // Collapse repeated consecutive words: "very very very" -> "very"
    const repeatPattern = /\b(\w{3,})((?:\s+\1)+)\b/gi;
    result = result.replace(repeatPattern, (matched, word: string, rest: string, offset: number) => {
      if (isInPreservedRegion(offset, result)) {
        return matched;
      }

      changes.push({
        original: matched,
        replacement: word,
        position: offset,
        rule: "structural:collapse-repeat",
      });

      return word;
    });

    return result;
  }

  private condenseLists(text: string, changes: Change[]): string {
    let result = text;

    // Condense long comma-separated lists into semicolon-delimited format
    // Only trigger on lists with 5+ comma-separated items on same line
    const lines = result.split("\n");
    const condensed = lines.map((line) => {
      const commaItems = line.split(/,\s*/);
      if (commaItems.length >= 5) {
        const trimmedItems = commaItems.map((i) => i.trim()).filter((i) => i.length > 0);
        const joined = trimmedItems.join("; ");
        changes.push({
          original: line.trim(),
          replacement: joined,
          position: result.indexOf(line),
          rule: "structural:condense-list",
        });
        return joined;
      }
      return line;
    });

    return condensed.join("\n");
  }
}
