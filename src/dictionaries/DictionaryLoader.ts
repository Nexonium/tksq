import type { SubstitutionDictionary } from "../pipeline/stages/IStage.js";
import { createGeneralDictionary } from "./domains/general.js";
import { createProgrammingDictionary } from "./domains/programming.js";
import { createLegalDictionary } from "./domains/legal.js";
import { createAcademicDictionary } from "./domains/academic.js";

export type DomainName = "general" | "programming" | "legal" | "academic";

const DOMAIN_FACTORIES: Record<DomainName, () => SubstitutionDictionary> = {
  general: createGeneralDictionary,
  programming: createProgrammingDictionary,
  legal: createLegalDictionary,
  academic: createAcademicDictionary,
};

export class DictionaryLoader {
  static load(
    domain: DomainName = "general",
    customSubstitutions?: Record<string, string>
  ): SubstitutionDictionary {
    const factory = DOMAIN_FACTORIES[domain];
    if (!factory) {
      throw new Error(
        `Unknown domain: ${domain}. Available: ${Object.keys(DOMAIN_FACTORIES).join(", ")}`
      );
    }

    const dict = factory();

    if (customSubstitutions) {
      for (const [key, value] of Object.entries(customSubstitutions)) {
        dict.substitutions.set(key.toLowerCase(), value);
      }
    }

    return dict;
  }

  static availableDomains(): DomainName[] {
    return Object.keys(DOMAIN_FACTORIES) as DomainName[];
  }
}
