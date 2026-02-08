import { DictionaryLoader } from "../DictionaryLoader.js";
import type { SubstitutionDictionary } from "../../pipeline/stages/IStage.js";

/**
 * @deprecated Use DictionaryLoader.load("general") instead.
 */
export function createGeneralDictionary(): SubstitutionDictionary {
  return DictionaryLoader.load("general", "en");
}
