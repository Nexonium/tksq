import type {
  ICompressionStage,
  PipelineConfig,
  PipelineResult,
  CompressionStats,
  StageStats,
  Change,
  CompressionLevel,
} from "./stages/IStage.js";
import { PatternPreserver } from "./preserver/PatternPreserver.js";
import { TokenCounterFactory, type ITokenCounter } from "../tokenizer/TokenCounter.js";
import { CleanupStage } from "./stages/CleanupStage.js";
import { SemanticStage } from "./stages/SemanticStage.js";
import { StructuralStage } from "./stages/StructuralStage.js";
import { ShorthandStage } from "./stages/ShorthandStage.js";

const LEVEL_STAGES: Record<CompressionLevel, string[]> = {
  light: ["cleanup"],
  medium: ["cleanup", "semantic"],
  aggressive: ["cleanup", "semantic", "structural", "shorthand"],
};

function createStageRegistry(): Map<string, ICompressionStage> {
  const stages: ICompressionStage[] = [
    new CleanupStage(),
    new SemanticStage(),
    new StructuralStage(),
    new ShorthandStage(),
  ];
  const map = new Map<string, ICompressionStage>();
  for (const stage of stages) {
    map.set(stage.id, stage);
  }
  return map;
}

export class Pipeline {
  private readonly preserver = new PatternPreserver();
  private readonly stageRegistry: Map<string, ICompressionStage>;

  constructor() {
    this.stageRegistry = createStageRegistry();
  }

  async compress(
    text: string,
    config: PipelineConfig
  ): Promise<PipelineResult> {
    const tokenCounter = await TokenCounterFactory.createReady(config.tokenizer);

    const stageIds = config.stages ?? LEVEL_STAGES[config.level];
    const stages = this.resolveStages(stageIds);

    const originalTokens = tokenCounter.count(text);
    const originalChars = text.length;

    // Extract preserved regions BEFORE pipeline
    const { processed: workingText, regions } = this.preserver.extract(
      text,
      config.preservePatterns
    );

    let current = workingText;
    const allChanges: Change[] = [];
    const stageBreakdown: StageStats[] = [];

    for (const stage of stages) {
      const tokensIn = tokenCounter.count(current);
      const startTime = performance.now();

      const result = stage.process(current, {
        level: config.level,
        preservedRegions: regions,
        dictionary: config.dictionary,
      });

      const endTime = performance.now();
      const tokensOut = tokenCounter.count(result.text);

      stageBreakdown.push({
        stage: stage.name,
        tokensIn,
        tokensOut,
        reductionPercent:
          tokensIn > 0
            ? Math.round(((tokensIn - tokensOut) / tokensIn) * 10000) / 100
            : 0,
        timeMs: Math.round((endTime - startTime) * 100) / 100,
      });

      allChanges.push(...result.changes);
      current = result.text;
    }

    // Restore preserved regions AFTER pipeline
    const compressed = this.preserver.restore(current, regions);

    const compressedTokens = tokenCounter.count(compressed);
    const compressedChars = compressed.length;

    const stats: CompressionStats = {
      originalTokens,
      compressedTokens,
      reductionPercent:
        originalTokens > 0
          ? Math.round(
              ((originalTokens - compressedTokens) / originalTokens) * 10000
            ) / 100
          : 0,
      originalChars,
      compressedChars,
      stageBreakdown,
      tokenizer: tokenCounter.name,
    };

    return {
      compressed,
      stats,
      allChanges,
    };
  }

  private resolveStages(stageIds: string[]): ICompressionStage[] {
    const stages: ICompressionStage[] = [];
    for (const id of stageIds) {
      const stage = this.stageRegistry.get(id);
      if (!stage) {
        const available = [...this.stageRegistry.keys()].join(", ");
        throw new Error(
          `Unknown stage "${id}". Available stages: ${available}`
        );
      }
      stages.push(stage);
    }
    return stages;
  }

  availableStages(): string[] {
    return [...this.stageRegistry.keys()];
  }

  static stagesForLevel(level: CompressionLevel): string[] {
    return [...LEVEL_STAGES[level]];
  }
}
