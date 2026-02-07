import type { SubstitutionDictionary } from "../../pipeline/stages/IStage.js";
import { createGeneralDictionary } from "./general.js";

const LEGAL_ABBREVIATIONS: Array<[string, string]> = [
  ["agreement", "agmt"],
  ["amendment", "amdt"],
  ["article", "art"],
  ["certificate", "cert"],
  ["clause", "cl"],
  ["contract", "ctr"],
  ["corporation", "corp"],
  ["defendant", "def"],
  ["department", "dept"],
  ["document", "doc"],
  ["documents", "docs"],
  ["execution", "exec"],
  ["government", "govt"],
  ["incorporation", "inc"],
  ["jurisdiction", "jur"],
  ["legislation", "legis"],
  ["paragraph", "para"],
  ["plaintiff", "pl"],
  ["provision", "prov"],
  ["regulation", "reg"],
  ["regulations", "regs"],
  ["representative", "rep"],
  ["section", "sec"],
  ["statute", "stat"],
  ["subdivision", "subdiv"],
  ["supplement", "supp"],
  ["testimony", "test"],
  ["transaction", "txn"],
];

const LEGAL_SUBSTITUTIONS: Array<[string, string]> = [
  ["in accordance with", "per"],
  ["pursuant to", "per"],
  ["with respect to", "regarding"],
  ["in the event that", "if"],
  ["in the event of", "if"],
  ["for the purpose of", "to"],
  ["on the grounds that", "because"],
  ["by virtue of", "under"],
  ["to the extent that", "insofar as"],
  ["in connection with", "regarding"],
  ["with regard to", "regarding"],
  ["at the present time", "currently"],
  ["at this point in time", "now"],
  ["prior to the commencement of", "before"],
  ["subsequent to", "after"],
  ["it is hereby agreed that", "agreed:"],
  ["the parties hereby agree that", "agreed:"],
  ["notwithstanding the foregoing", "despite above"],
  ["in lieu of", "instead of"],
  ["due to the fact that", "because"],
  ["for the reason that", "because"],
  ["provided however that", "but"],
  ["on the condition that", "if"],
  ["subject to the provisions of", "under"],
  ["in compliance with", "per"],
  ["shall be entitled to", "may"],
  ["shall have the right to", "may"],
  ["shall be deemed to", "is considered"],
  ["in the absence of", "without"],
  ["in the amount of", "of"],
  ["for a period of", "for"],
  ["within the meaning of", "as defined in"],
  ["the undersigned hereby", "I/we"],
  ["hereinafter referred to as", "called"],
];

export function createLegalDictionary(): SubstitutionDictionary {
  const general = createGeneralDictionary();

  for (const [key, value] of LEGAL_SUBSTITUTIONS) {
    general.substitutions.set(key.toLowerCase(), value);
  }

  const abbreviations = new Map<string, string>();
  for (const [full, abbr] of LEGAL_ABBREVIATIONS) {
    abbreviations.set(full.toLowerCase(), abbr);
  }

  return {
    fillers: general.fillers,
    substitutions: general.substitutions,
    redundancies: general.redundancies,
    abbreviations,
  };
}
