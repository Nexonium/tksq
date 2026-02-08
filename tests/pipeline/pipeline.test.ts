import { describe, it, expect } from "vitest";
import { Pipeline } from "../../src/pipeline/Pipeline.js";
import { DictionaryLoader } from "../../src/dictionaries/DictionaryLoader.js";
import type { PipelineConfig } from "../../src/pipeline/stages/IStage.js";

describe("Pipeline", () => {
  const pipeline = new Pipeline();

  function makeConfig(
    level: "light" | "medium" | "aggressive" = "medium",
    domain: "general" | "programming" | "legal" | "academic" = "general"
  ): PipelineConfig {
    return {
      level,
      preservePatterns: [],
      tokenizer: "approximate",
      dictionary: DictionaryLoader.load(domain),
    };
  }

  it("returns compressed text shorter than original", async () => {
    const text =
      "Basically, in order to understand this, it is important to note that " +
      "the implementation is responsible for handling the configuration. " +
      "Essentially, this function will return the result.";
    const result = await pipeline.compress(text, makeConfig());
    expect(result.compressed.length).toBeLessThan(text.length);
    expect(result.stats.reductionPercent).toBeGreaterThan(0);
  });

  it("light level only runs cleanup", async () => {
    const text = "hello    world   \n\n\n\ntest";
    const result = await pipeline.compress(text, makeConfig("light"));
    expect(result.stats.stageBreakdown).toHaveLength(1);
    expect(result.stats.stageBreakdown[0].stage).toBe("Cleanup");
  });

  it("medium level runs cleanup + semantic", async () => {
    const text = "In order to test this feature";
    const result = await pipeline.compress(text, makeConfig("medium"));
    expect(result.stats.stageBreakdown).toHaveLength(2);
    expect(result.stats.stageBreakdown[0].stage).toBe("Cleanup");
    expect(result.stats.stageBreakdown[1].stage).toBe("Semantic");
  });

  it("aggressive level runs all 4 stages", async () => {
    const text = "It is important to note that I do not want to do this.";
    const result = await pipeline.compress(text, makeConfig("aggressive"));
    expect(result.stats.stageBreakdown).toHaveLength(4);
    const stageNames = result.stats.stageBreakdown.map((s) => s.stage);
    expect(stageNames).toEqual(["Cleanup", "Semantic", "Structural", "Shorthand"]);
  });

  it("preserves code blocks", async () => {
    const text =
      "Here is some code:\n```js\nconst x = 1;\n```\nBasically, that was it.";
    const result = await pipeline.compress(text, makeConfig());
    expect(result.compressed).toContain("const x = 1;");
  });

  it("preserves inline code", async () => {
    const text = "Use `console.log()` to debug basically";
    const result = await pipeline.compress(text, makeConfig());
    expect(result.compressed).toContain("`console.log()`");
  });

  it("aggressive gives higher reduction than medium", async () => {
    const text =
      "It is important to note that in order to achieve the desired result, " +
      "one should not forget that the implementation is responsible for " +
      "handling the configuration and the parameters. " +
      "I do not think this will not work properly.";
    const medium = await pipeline.compress(text, makeConfig("medium"));
    const aggressive = await pipeline.compress(text, makeConfig("aggressive"));
    expect(aggressive.stats.reductionPercent).toBeGreaterThanOrEqual(
      medium.stats.reductionPercent
    );
  });

  it("returns correct stats shape", async () => {
    const text = "Hello world";
    const result = await pipeline.compress(text, makeConfig());
    expect(result.stats).toHaveProperty("originalTokens");
    expect(result.stats).toHaveProperty("compressedTokens");
    expect(result.stats).toHaveProperty("reductionPercent");
    expect(result.stats).toHaveProperty("originalChars");
    expect(result.stats).toHaveProperty("compressedChars");
    expect(result.stats).toHaveProperty("stageBreakdown");
    expect(result.stats).toHaveProperty("tokenizer");
  });

  it("lists available stages", () => {
    const stages = pipeline.availableStages();
    expect(stages).toContain("cleanup");
    expect(stages).toContain("semantic");
    expect(stages).toContain("structural");
    expect(stages).toContain("shorthand");
  });

  it("stagesForLevel returns correct stages", () => {
    expect(Pipeline.stagesForLevel("light")).toEqual(["cleanup"]);
    expect(Pipeline.stagesForLevel("medium")).toEqual(["cleanup", "semantic"]);
    expect(Pipeline.stagesForLevel("aggressive")).toEqual([
      "cleanup",
      "semantic",
      "structural",
      "shorthand",
    ]);
  });
});
