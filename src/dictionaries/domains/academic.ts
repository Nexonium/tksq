import type { SubstitutionDictionary } from "../../pipeline/stages/IStage.js";
import { createGeneralDictionary } from "./general.js";

export const ACADEMIC_ABBREVIATIONS: Array<[string, string]> = [
  ["approximately", "approx"],
  ["bibliography", "biblio"],
  ["chapter", "ch"],
  ["comparison", "comp"],
  ["conclusion", "concl"],
  ["definition", "def"],
  ["department", "dept"],
  ["dissertation", "diss"],
  ["edition", "ed"],
  ["equation", "eq"],
  ["experiment", "exp"],
  ["figure", "fig"],
  ["hypothesis", "hyp"],
  ["illustration", "illus"],
  ["introduction", "intro"],
  ["manuscript", "ms"],
  ["methodology", "method"],
  ["observation", "obs"],
  ["paragraph", "para"],
  ["population", "pop"],
  ["publication", "pub"],
  ["reference", "ref"],
  ["references", "refs"],
  ["respectively", "resp"],
  ["significance", "sig"],
  ["standard deviation", "SD"],
  ["supplement", "suppl"],
  ["table", "tbl"],
  ["theoretical", "theor"],
  ["volume", "vol"],
];

export const ACADEMIC_SUBSTITUTIONS: Array<[string, string]> = [
  ["it has been demonstrated that", "studies show"],
  ["it has been shown that", "evidence shows"],
  ["it is widely accepted that", "widely accepted:"],
  ["the results indicate that", "results show"],
  ["the findings suggest that", "findings suggest"],
  ["the data demonstrate that", "data show"],
  ["a significant amount of", "significant"],
  ["a considerable number of", "many"],
  ["a growing body of", "increasing"],
  ["in the field of", "in"],
  ["in the context of", "in"],
  ["in the domain of", "in"],
  ["plays a significant role in", "affects"],
  ["plays an important role in", "affects"],
  ["in the current study", "here"],
  ["in the present study", "here"],
  ["in the present paper", "here"],
  ["the aim of this study is to", "this study aims to"],
  ["the purpose of this study is to", "this study aims to"],
  ["the objective of this research is to", "this research aims to"],
  ["it should be noted that", "note:"],
  ["it is worth mentioning that", "notably"],
  ["with the exception of", "except"],
  ["as a consequence of", "due to"],
  ["as a result of this", "consequently"],
  ["on the basis of", "based on"],
  ["in terms of", "regarding"],
  ["a number of studies have", "several studies"],
  ["a large number of", "many"],
  ["in close proximity to", "near"],
  ["for the purpose of this analysis", "here"],
  ["the majority of", "most"],
  ["a minority of", "few"],
  ["in comparison with", "vs"],
  ["in contrast to", "unlike"],
  ["is consistent with", "matches"],
  ["is in agreement with", "matches"],
];

export function createAcademicDictionary(): SubstitutionDictionary {
  const general = createGeneralDictionary();

  for (const [key, value] of ACADEMIC_SUBSTITUTIONS) {
    general.substitutions.set(key.toLowerCase(), value);
  }

  const abbreviations = new Map<string, string>();
  for (const [full, abbr] of ACADEMIC_ABBREVIATIONS) {
    abbreviations.set(full.toLowerCase(), abbr);
  }

  return {
    ...general,
    substitutions: general.substitutions,
    abbreviations,
  };
}
