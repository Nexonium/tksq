import { diffWords } from "diff";

export interface DiffSegment {
  value: string;
  added: boolean;
  removed: boolean;
}

export interface DiffResult {
  segments: DiffSegment[];
  formatted: string;
  addedCount: number;
  removedCount: number;
}

export class TextDiffer {
  diff(original: string, compressed: string): DiffResult {
    const rawDiff = diffWords(original, compressed);

    const segments: DiffSegment[] = [];
    let addedCount = 0;
    let removedCount = 0;

    for (const part of rawDiff) {
      segments.push({
        value: part.value,
        added: part.added ?? false,
        removed: part.removed ?? false,
      });

      if (part.removed) {
        removedCount += this.countWords(part.value);
      }
      if (part.added) {
        addedCount += this.countWords(part.value);
      }
    }

    const formatted = this.formatDiff(segments);

    return { segments, formatted, addedCount, removedCount };
  }

  private formatDiff(segments: DiffSegment[]): string {
    const parts: string[] = [];

    for (const segment of segments) {
      if (segment.removed) {
        parts.push(`[-${segment.value.trim()}-]`);
      } else if (segment.added) {
        parts.push(`[+${segment.value.trim()}+]`);
      } else {
        parts.push(segment.value);
      }
    }

    return parts.join("");
  }

  private countWords(text: string): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
  }
}
