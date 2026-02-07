import type { PreservedRegion } from "../stages/IStage.js";

export class PatternPreserver {
  private static readonly BUILT_IN_PATTERNS: RegExp[] = [
    /```[\s\S]*?```/g,       // Fenced code blocks
    /`[^`]+`/g,               // Inline code
    /https?:\/\/\S+/g,        // URLs
    /"[^"]{80,}"/g,           // Long quoted strings (80+ chars, likely intentional)
  ];

  extract(
    text: string,
    userPatterns: RegExp[]
  ): { processed: string; regions: PreservedRegion[] } {
    const allPatterns = [...PatternPreserver.BUILT_IN_PATTERNS, ...userPatterns];
    const regions: PreservedRegion[] = [];

    // Collect all matches
    const matches: Array<{ start: number; end: number; text: string }> = [];

    for (const pattern of allPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
      }
    }

    // Remove overlapping matches (keep longer ones)
    const deduped = this.removeOverlaps(matches);

    // Sort by position descending to replace from end (preserves earlier positions)
    deduped.sort((a, b) => b.start - a.start);

    let processed = text;
    for (let i = 0; i < deduped.length; i++) {
      const m = deduped[i];
      const placeholder = `\x00TKSQ_${i}\x00`;
      regions.push({
        start: m.start,
        end: m.end,
        placeholder,
        originalText: m.text,
      });
      processed =
        processed.slice(0, m.start) + placeholder + processed.slice(m.end);
    }

    return { processed, regions };
  }

  restore(text: string, regions: PreservedRegion[]): string {
    let result = text;
    for (const region of regions) {
      result = result.replace(region.placeholder, region.originalText);
    }
    return result;
  }

  private removeOverlaps(
    matches: Array<{ start: number; end: number; text: string }>
  ): Array<{ start: number; end: number; text: string }> {
    // Sort by length descending, greedily keep non-overlapping
    const sorted = [...matches].sort(
      (a, b) => (b.end - b.start) - (a.end - a.start)
    );
    const kept: typeof sorted = [];
    for (const m of sorted) {
      const overlaps = kept.some(
        (k) => m.start < k.end && m.end > k.start
      );
      if (!overlaps) kept.push(m);
    }
    return kept;
  }
}
