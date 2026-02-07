import type { TokenizerType } from "../pipeline/stages/IStage.js";

export interface ITokenCounter {
  count(text: string): number;
  readonly name: string;
}

export class ApproximateCounter implements ITokenCounter {
  readonly name = "approximate";

  count(text: string): number {
    // ~4 characters per token is a reasonable approximation for English
    // Adjusted: whitespace-heavy text has slightly fewer chars/token
    if (text.length === 0) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }
}

let _tiktokenCache: Map<string, ITokenCounter> = new Map();

export class TiktokenCounter implements ITokenCounter {
  readonly name: string;
  private encoder: { encode: (text: string) => number[] } | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private encoding: "cl100k_base" | "o200k_base") {
    this.name = encoding;
  }

  private async init(): Promise<void> {
    if (this.encoder) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = (async () => {
      const { encodingForModel } = await import("js-tiktoken");
      // cl100k_base is used by GPT-4, o200k_base by GPT-4o
      // For Claude, cl100k_base is a close approximation
      const model = this.encoding === "cl100k_base" ? "gpt-4" : "gpt-4o";
      this.encoder = encodingForModel(model as any);
    })();
    await this.initPromise;
  }

  count(text: string): number {
    if (text.length === 0) return 0;
    if (!this.encoder) {
      // Fallback to approximate if not yet initialized
      return Math.max(1, Math.ceil(text.length / 4));
    }
    return this.encoder.encode(text).length;
  }

  async ensureReady(): Promise<void> {
    await this.init();
  }
}

export class TokenCounterFactory {
  static create(type: TokenizerType): ITokenCounter {
    if (type === "approximate") {
      return new ApproximateCounter();
    }

    const cached = _tiktokenCache.get(type);
    if (cached) return cached;

    const counter = new TiktokenCounter(type);
    _tiktokenCache.set(type, counter);
    return counter;
  }

  static async createReady(type: TokenizerType): Promise<ITokenCounter> {
    const counter = TokenCounterFactory.create(type);
    if (counter instanceof TiktokenCounter) {
      await counter.ensureReady();
    }
    return counter;
  }
}
