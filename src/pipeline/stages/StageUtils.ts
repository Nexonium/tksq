/**
 * Shared utilities for compression stages.
 */

const PLACEHOLDER_PATTERN = /\x00TKSQ_\d+\x00/g;

/**
 * Check if a position falls inside a preserved region placeholder.
 */
export function isInPreservedRegion(position: number, text: string): boolean {
  const regex = new RegExp(PLACEHOLDER_PATTERN.source, PLACEHOLDER_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (position >= match.index && position < match.index + match[0].length) {
      return true;
    }
  }
  return false;
}

/**
 * Escape special regex characters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match the case style of the original text in the replacement.
 * - ALL CAPS -> ALL CAPS replacement
 * - Title Case -> Title Case replacement
 * - lowercase -> lowercase replacement
 */
export function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.length > 1) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
