import type { SubstitutionDictionary } from "../pipeline/stages/IStage.js";
import type { LanguageCode } from "./languages/types.js";
import { LanguageRegistry } from "./languages/registry.js";
import {
  PROGRAMMING_ABBREVIATIONS,
  PROGRAMMING_SUBSTITUTIONS,
} from "./domains/programming.js";
import {
  LEGAL_ABBREVIATIONS,
  LEGAL_SUBSTITUTIONS,
} from "./domains/legal.js";
import {
  ACADEMIC_ABBREVIATIONS,
  ACADEMIC_SUBSTITUTIONS,
} from "./domains/academic.js";

export type DomainName = "general" | "programming" | "legal" | "academic";

type DomainOverlay = (dict: SubstitutionDictionary) => void;

function applyOverlay(
  dict: SubstitutionDictionary,
  substitutions: Array<[string, string]>,
  abbreviations: Array<[string, string]>
): void {
  for (const [key, value] of substitutions) {
    dict.substitutions.set(key.toLowerCase(), value);
  }
  for (const [full, abbr] of abbreviations) {
    dict.abbreviations.set(full.toLowerCase(), abbr);
  }
}

const DOMAIN_OVERLAYS: Record<DomainName, DomainOverlay> = {
  general: () => {},
  programming: (dict) =>
    applyOverlay(dict, PROGRAMMING_SUBSTITUTIONS, PROGRAMMING_ABBREVIATIONS),
  legal: (dict) =>
    applyOverlay(dict, LEGAL_SUBSTITUTIONS, LEGAL_ABBREVIATIONS),
  academic: (dict) =>
    applyOverlay(dict, ACADEMIC_SUBSTITUTIONS, ACADEMIC_ABBREVIATIONS),
};

export class DictionaryLoader {
  static load(
    domain: DomainName = "general",
    language: LanguageCode = "en",
    customSubstitutions?: Record<string, string>
  ): SubstitutionDictionary {
    if (!DOMAIN_OVERLAYS[domain]) {
      const available = Object.keys(DOMAIN_OVERLAYS).join(", ");
      throw new Error(`Unknown domain: ${domain}. Available: ${available}`);
    }

    const pack = LanguageRegistry.get(language);

    const substitutions = new Map<string, string>();
    for (const [key, value] of pack.substitutions) {
      substitutions.set(key.toLowerCase(), value);
    }

    const dict: SubstitutionDictionary = {
      language: pack.code,
      script: pack.script,
      fillers: pack.fillers.map((f) => f.toLowerCase()),
      substitutions,
      redundancies: pack.redundancies.map((r) => ({
        pattern: new RegExp(r.pattern.source, r.pattern.flags),
        replacement: r.replacement,
      })),
      abbreviations: new Map<string, string>(),
      shorthand: {
        contractions: pack.shorthand.contractions,
        articles: pack.shorthand.articles,
        copulas: pack.shorthand.copulas,
        pronounElision: pack.shorthand.pronounElision,
        patronymicPattern: pack.shorthand.patronymicPattern,
      },
      capitalizeAfterPeriod: pack.capitalizeAfterPeriod,
    };

    DOMAIN_OVERLAYS[domain](dict);

    if (customSubstitutions) {
      for (const [key, value] of Object.entries(customSubstitutions)) {
        dict.substitutions.set(key.toLowerCase(), value);
      }
    }

    return dict;
  }

  static availableDomains(): DomainName[] {
    return Object.keys(DOMAIN_OVERLAYS) as DomainName[];
  }
}
