import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ConfigManager } from "../config/ConfigManager.js";
import type { LearnedData, CandidatePattern } from "./types.js";
import { EMPTY_LEARNED_DATA } from "./types.js";

export class PhraseStore {
  private data: LearnedData | null = null;
  private dirty = false;

  static getStorePath(): string {
    return join(ConfigManager.getConfigDir(), "learned.json");
  }

  async load(): Promise<LearnedData> {
    if (this.data) return this.data;

    try {
      const raw = await readFile(PhraseStore.getStorePath(), "utf-8");
      const parsed = JSON.parse(raw);
      this.data = {
        ...EMPTY_LEARNED_DATA,
        ...parsed,
        stats: { ...EMPTY_LEARNED_DATA.stats, ...(parsed.stats ?? {}) },
      };
    } catch {
      this.data = {
        ...EMPTY_LEARNED_DATA,
        candidates: {},
        promoted: {},
        stats: { ...EMPTY_LEARNED_DATA.stats },
      };
    }

    return this.data!;
  }

  async save(): Promise<void> {
    if (!this.data || !this.dirty) return;

    const dir = ConfigManager.getConfigDir();
    await mkdir(dir, { recursive: true });
    await writeFile(
      PhraseStore.getStorePath(),
      JSON.stringify(this.data, null, 2),
      "utf-8"
    );
    this.dirty = false;
  }

  async flush(): Promise<void> {
    await this.save();
  }

  async addCandidate(
    phrase: string,
    suggestedReplacement: string | null,
    maxCandidates: number
  ): Promise<void> {
    const data = await this.load();
    const key = phrase.toLowerCase();
    const now = new Date().toISOString();

    if (data.candidates[key]) {
      data.candidates[key].count++;
      data.candidates[key].lastSeen = now;
      if (suggestedReplacement && !data.candidates[key].suggestedReplacement) {
        data.candidates[key].suggestedReplacement = suggestedReplacement;
      }
    } else {
      data.candidates[key] = {
        phrase,
        suggestedReplacement,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      };
    }

    this.evictIfNeeded(data, maxCandidates);
    this.dirty = true;
  }

  async incrementCandidate(phrase: string): Promise<void> {
    const data = await this.load();
    const key = phrase.toLowerCase();

    if (data.candidates[key]) {
      data.candidates[key].count++;
      data.candidates[key].lastSeen = new Date().toISOString();
      this.dirty = true;
    }
  }

  async promote(phrase: string, replacement: string): Promise<boolean> {
    const data = await this.load();
    const key = phrase.toLowerCase();

    data.promoted[key] = replacement;
    delete data.candidates[key];
    this.dirty = true;
    await this.save();
    return true;
  }

  async reject(phrase: string): Promise<boolean> {
    const data = await this.load();
    const key = phrase.toLowerCase();

    if (!data.candidates[key]) return false;
    delete data.candidates[key];
    this.dirty = true;
    await this.save();
    return true;
  }

  async getCandidates(): Promise<CandidatePattern[]> {
    const data = await this.load();
    return Object.values(data.candidates).sort((a, b) => b.count - a.count);
  }

  async getPromoted(): Promise<Record<string, string>> {
    const data = await this.load();
    return { ...data.promoted };
  }

  async getReadyCandidates(minFrequency: number): Promise<CandidatePattern[]> {
    const candidates = await this.getCandidates();
    return candidates.filter(
      (c) => c.count >= minFrequency && c.suggestedReplacement !== null
    );
  }

  async updateStats(
    tokensSaved: number,
    charsOriginal: number,
    charsCompressed: number
  ): Promise<void> {
    const data = await this.load();
    data.stats.totalCompressions++;
    data.stats.totalTokensSaved += tokensSaved;
    data.stats.totalCharsOriginal += charsOriginal;
    data.stats.totalCharsCompressed += charsCompressed;
    this.dirty = true;
  }

  async getStats(): Promise<LearnedData["stats"]> {
    const data = await this.load();
    return { ...data.stats };
  }

  async incrementSessionCount(): Promise<void> {
    const data = await this.load();
    data.stats.sessionCount++;
    this.dirty = true;
    await this.save();
  }

  async reset(): Promise<void> {
    this.data = {
      ...EMPTY_LEARNED_DATA,
      candidates: {},
      promoted: {},
      stats: { ...EMPTY_LEARNED_DATA.stats },
    };
    this.dirty = true;
    await this.save();
  }

  private evictIfNeeded(data: LearnedData, maxCandidates: number): void {
    const keys = Object.keys(data.candidates);
    if (keys.length <= maxCandidates) return;

    const sorted = keys
      .map((k) => ({ key: k, ...data.candidates[k] }))
      .sort((a, b) => a.count - b.count || a.lastSeen.localeCompare(b.lastSeen));

    const toRemove = sorted.length - maxCandidates;
    for (let i = 0; i < toRemove; i++) {
      delete data.candidates[sorted[i].key];
    }
  }
}
