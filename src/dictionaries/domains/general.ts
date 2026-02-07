import type { SubstitutionDictionary } from "../../pipeline/stages/IStage.js";
import { FILLERS } from "../fillers.js";
import { SUBSTITUTIONS } from "../substitutions.js";
import { REDUNDANCIES } from "../redundancies.js";

export function createGeneralDictionary(): SubstitutionDictionary {
  const substitutions = new Map<string, string>();
  for (const [key, value] of SUBSTITUTIONS) {
    substitutions.set(key.toLowerCase(), value);
  }

  return {
    fillers: FILLERS.map((f) => f.toLowerCase()),
    substitutions,
    redundancies: REDUNDANCIES.map((r) => ({
      pattern: new RegExp(r.pattern.source, r.pattern.flags),
      replacement: r.replacement,
    })),
    abbreviations: new Map<string, string>(),
  };
}
