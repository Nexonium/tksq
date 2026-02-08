#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Public API exports
export { createServer } from "./server.js";
export { Pipeline } from "./pipeline/Pipeline.js";
export { DictionaryLoader } from "./dictionaries/DictionaryLoader.js";
export { TokenCounterFactory } from "./tokenizer/TokenCounter.js";
export { TextDiffer } from "./diff/TextDiffer.js";
export { ConfigManager } from "./config/ConfigManager.js";
export { LanguageDetector } from "./language/LanguageDetector.js";
export { LanguageRegistry } from "./dictionaries/languages/registry.js";
export { buildWordBoundaryRegex } from "./language/WordBoundary.js";
export type { CompressionLevel, TokenizerType, PipelineConfig, PipelineResult, CompressionStats } from "./pipeline/stages/IStage.js";
export type { DomainName } from "./dictionaries/DictionaryLoader.js";
export type { LanguageCode, ScriptType, LanguagePack, ShorthandConfig } from "./dictionaries/languages/types.js";
export type { LanguageSetting, TksqConfig } from "./config/defaults.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting tksq server:", error);
  process.exit(1);
});
