import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Pipeline } from "./pipeline/Pipeline.js";
import { DictionaryLoader, type DomainName } from "./dictionaries/DictionaryLoader.js";
import { ConfigManager } from "./config/ConfigManager.js";
import { TextDiffer } from "./diff/TextDiffer.js";
import { TokenCounterFactory } from "./tokenizer/TokenCounter.js";
import type {
  CompressionLevel,
  TokenizerType,
  PipelineConfig,
} from "./pipeline/stages/IStage.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tksq",
    version: "1.0.0",
  });

  const pipeline = new Pipeline();
  const configManager = new ConfigManager();
  const differ = new TextDiffer();

  // -- tksq_compress --

  server.tool(
    "tksq_compress",
    "Compress text to reduce LLM token usage while preserving meaning. " +
      "Removes filler phrases, applies concise substitutions, and normalizes whitespace. " +
      "Automatically preserves code blocks, inline code, and URLs. " +
      "Returns compressed text with token reduction statistics.",
    {
      text: z.string().describe("The text to compress"),
      level: z
        .enum(["light", "medium", "aggressive"])
        .optional()
        .describe(
          "Compression level. light=cleanup only, medium=cleanup+semantic (default), aggressive=cleanup+semantic"
        ),
      domain: z
        .enum(["general", "programming"])
        .optional()
        .describe(
          "Dictionary domain. general=prose (default), programming=adds code abbreviations"
        ),
      tokenizer: z
        .enum(["cl100k_base", "o200k_base", "approximate"])
        .optional()
        .describe(
          "Tokenizer for counting. cl100k_base=GPT-4/Claude (default), o200k_base=GPT-4o, approximate=fast estimate"
        ),
      preserve_patterns: z
        .array(z.string())
        .optional()
        .describe(
          "Additional regex patterns for text regions to preserve (code blocks, URLs already preserved by default)"
        ),
    },
    async (args) => {
      try {
        const userConfig = await configManager.load();

        const level: CompressionLevel = args.level ?? userConfig.level;
        const domain: DomainName = args.domain ?? userConfig.domain;
        const tokenizer: TokenizerType = args.tokenizer ?? userConfig.tokenizer;

        const dictionary = DictionaryLoader.load(
          domain,
          Object.keys(userConfig.customSubstitutions).length > 0
            ? userConfig.customSubstitutions
            : undefined
        );

        const userPatterns: RegExp[] = [];
        const configPatterns = args.preserve_patterns ?? userConfig.preservePatterns;
        for (const p of configPatterns) {
          try {
            userPatterns.push(new RegExp(p, "g"));
          } catch {
            // Skip invalid patterns
          }
        }

        const pipelineConfig: PipelineConfig = {
          level,
          preservePatterns: userPatterns,
          tokenizer,
          dictionary,
        };

        const result = await pipeline.compress(args.text, pipelineConfig);

        const stageBreakdown = result.stats.stageBreakdown
          .map(
            (s) =>
              `  ${s.stage}: ${s.tokensIn} -> ${s.tokensOut} tokens (-${s.reductionPercent}%, ${s.timeMs}ms)`
          )
          .join("\n");

        const output = [
          result.compressed,
          "",
          "---",
          `Tokens: ${result.stats.originalTokens} -> ${result.stats.compressedTokens} (-${result.stats.reductionPercent}%)`,
          `Chars: ${result.stats.originalChars} -> ${result.stats.compressedChars}`,
          `Tokenizer: ${result.stats.tokenizer}`,
          `Level: ${level} | Domain: ${domain}`,
          `Changes: ${result.allChanges.length}`,
          "Stages:",
          stageBreakdown,
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Compression error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // -- tksq_count --

  server.tool(
    "tksq_count",
    "Count the number of LLM tokens in the given text. " +
      "Supports multiple tokenizer encodings. " +
      "Useful for checking token usage before and after manual edits.",
    {
      text: z.string().describe("The text to count tokens for"),
      tokenizer: z
        .enum(["cl100k_base", "o200k_base", "approximate"])
        .optional()
        .describe(
          "Tokenizer encoding. cl100k_base=GPT-4/Claude (default), o200k_base=GPT-4o, approximate=fast ~4 chars/token"
        ),
    },
    async (args) => {
      try {
        const userConfig = await configManager.load();
        const tokenizer: TokenizerType =
          args.tokenizer ?? userConfig.tokenizer;

        const counter = await TokenCounterFactory.createReady(tokenizer);
        const count = counter.count(args.text);

        const lines = args.text.split("\n").length;
        const words = args.text
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        const chars = args.text.length;

        const output = [
          `Tokens: ${count}`,
          `Characters: ${chars}`,
          `Words: ${words}`,
          `Lines: ${lines}`,
          `Tokenizer: ${counter.name}`,
          `Ratio: ~${chars > 0 ? (chars / count).toFixed(1) : "0"} chars/token`,
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Count error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // -- tksq_diff --

  server.tool(
    "tksq_diff",
    "Show a word-level diff between original and compressed text. " +
      "Highlights what was removed and what was substituted. " +
      "Accepts either two texts to compare, or a single text that will be compressed first.",
    {
      original: z.string().describe("The original text"),
      compressed: z
        .string()
        .optional()
        .describe(
          "The compressed text to compare against. If omitted, the original will be compressed automatically."
        ),
      level: z
        .enum(["light", "medium", "aggressive"])
        .optional()
        .describe("Compression level (only used if compressed is omitted)"),
      domain: z
        .enum(["general", "programming"])
        .optional()
        .describe("Dictionary domain (only used if compressed is omitted)"),
    },
    async (args) => {
      try {
        let compressedText: string;
        let stats = "";

        if (args.compressed !== undefined) {
          compressedText = args.compressed;
        } else {
          const userConfig = await configManager.load();
          const level: CompressionLevel = args.level ?? userConfig.level;
          const domain: DomainName = args.domain ?? userConfig.domain;

          const dictionary = DictionaryLoader.load(
            domain,
            Object.keys(userConfig.customSubstitutions).length > 0
              ? userConfig.customSubstitutions
              : undefined
          );

          const pipelineConfig: PipelineConfig = {
            level,
            preservePatterns: [],
            tokenizer: userConfig.tokenizer,
            dictionary,
          };

          const result = await pipeline.compress(args.original, pipelineConfig);
          compressedText = result.compressed;
          stats = `\nTokens: ${result.stats.originalTokens} -> ${result.stats.compressedTokens} (-${result.stats.reductionPercent}%)`;
        }

        const diffResult = differ.diff(args.original, compressedText);

        const output = [
          "Diff ([-removed-] [+added+]):",
          "",
          diffResult.formatted,
          "",
          "---",
          `Words removed: ${diffResult.removedCount}`,
          `Words added: ${diffResult.addedCount}`,
          `Net change: ${diffResult.addedCount - diffResult.removedCount} words`,
          stats,
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Diff error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
