import type { ScriptType } from "../dictionaries/languages/types.js";
import { escapeRegex } from "../pipeline/stages/StageUtils.js";

/**
 * Build a word-boundary-wrapped regex pattern for the given script type.
 *
 * JavaScript's \b only works for ASCII [a-zA-Z0-9_].
 * For Cyrillic and other Unicode scripts, we use Unicode property escapes
 * with lookbehind/lookahead to match word boundaries correctly.
 */
export function buildBoundaryPattern(
  escaped: string,
  script: ScriptType
): string {
  switch (script) {
    case "cyrillic":
      return `(?<![\\p{L}])${escaped}(?![\\p{L}])`;
    case "latin":
    default:
      return `\\b${escaped}\\b`;
  }
}

/**
 * Build a RegExp with proper word boundaries for a phrase in the given script.
 */
export function buildWordBoundaryRegex(
  phrase: string,
  script: ScriptType,
  flags: string = "gi"
): RegExp {
  const escaped = escapeRegex(phrase);
  const pattern = buildBoundaryPattern(escaped, script);
  // Cyrillic patterns need 'u' flag for \p{L} Unicode property escapes
  const finalFlags =
    script === "cyrillic" && !flags.includes("u") ? flags + "u" : flags;
  return new RegExp(pattern, finalFlags);
}
