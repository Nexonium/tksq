import type { LanguagePack } from "./types.js";
import { FILLERS } from "../fillers.js";
import { SUBSTITUTIONS } from "../substitutions.js";
import { REDUNDANCIES } from "../redundancies.js";

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bdo not\b/gi, "don't"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bwill have\b/gi, "will've"],
  [/\bwould have\b/gi, "would've"],
  [/\bcould have\b/gi, "could've"],
  [/\bshould have\b/gi, "should've"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bthere is\b/gi, "there's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bwho is\b/gi, "who's"],
  [/\blet us\b/gi, "let's"],
  [/\bI am\b/g, "I'm"],
  [/\bI have\b/g, "I've"],
  [/\bI will\b/g, "I'll"],
  [/\bI would\b/g, "I'd"],
  [/\byou are\b/gi, "you're"],
  [/\byou have\b/gi, "you've"],
  [/\byou will\b/gi, "you'll"],
  [/\byou would\b/gi, "you'd"],
  [/\bwe are\b/gi, "we're"],
  [/\bwe have\b/gi, "we've"],
  [/\bwe will\b/gi, "we'll"],
  [/\bthey are\b/gi, "they're"],
  [/\bthey have\b/gi, "they've"],
  [/\bthey will\b/gi, "they'll"],
];

const COPULA_PATTERNS: Array<[RegExp, string]> = [
  [/\bit is important to note that\b/gi, "notably"],
  [/\bit is worth noting that\b/gi, "notably"],
  [/\bit is necessary to\b/gi, "must"],
  [/\bit is possible to\b/gi, "can"],
  [/\bit is recommended to\b/gi, "should"],
  [/\bthere are many\b/gi, "many"],
  [/\bthere are several\b/gi, "several"],
  [/\bthere are some\b/gi, "some"],
  [/\bthere is a need to\b/gi, "need to"],
];

const ARTICLE_PATTERN = /\b(the|a|an)\s+/gi;

export const englishPack: LanguagePack = {
  code: "en",
  script: "latin",

  fillers: FILLERS,
  substitutions: SUBSTITUTIONS,
  redundancies: REDUNDANCIES,

  shorthand: {
    contractions: CONTRACTIONS,
    articles: ARTICLE_PATTERN,
    copulas: COPULA_PATTERNS,
  },

  capitalizeAfterPeriod: /\.\s+([a-z])/g,
};
