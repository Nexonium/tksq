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
    version: "1.1.0",
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
          "Compression level. light=cleanup only, medium=cleanup+semantic (default), aggressive=all 4 stages"
        ),
      domain: z
        .enum(["general", "programming", "legal", "academic"])
        .optional()
        .describe(
          "Dictionary domain. general=prose (default), programming=code, legal=contracts, academic=papers"
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
        .enum(["general", "programming", "legal", "academic"])
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

  // -- tksq_benchmark --

  server.tool(
    "tksq_benchmark",
    "Benchmark compression on a text sample across all levels and domains. " +
      "Shows token reduction for each level (light, medium, aggressive) side by side. " +
      "Helps choose optimal compression settings for your content.",
    {
      text: z.string().describe("The text to benchmark"),
      domain: z
        .enum(["general", "programming", "legal", "academic"])
        .optional()
        .describe("Dictionary domain (default: general)"),
      tokenizer: z
        .enum(["cl100k_base", "o200k_base", "approximate"])
        .optional()
        .describe("Tokenizer for counting (default: cl100k_base)"),
    },
    async (args) => {
      try {
        const userConfig = await configManager.load();
        const domain: DomainName = args.domain ?? userConfig.domain;
        const tokenizer: TokenizerType = args.tokenizer ?? userConfig.tokenizer;

        const dictionary = DictionaryLoader.load(domain);
        const levels: CompressionLevel[] = ["light", "medium", "aggressive"];
        const rows: string[] = [];

        const counter = await TokenCounterFactory.createReady(tokenizer);
        const originalTokens = counter.count(args.text);

        rows.push(`Original: ${originalTokens} tokens (${args.text.length} chars)`);
        rows.push(`Domain: ${domain} | Tokenizer: ${tokenizer}`);
        rows.push("");
        rows.push("Level        | Tokens | Reduction | Stages");
        rows.push("-------------|--------|-----------|-------");

        for (const level of levels) {
          const config: PipelineConfig = {
            level,
            preservePatterns: [],
            tokenizer,
            dictionary,
          };

          const result = await pipeline.compress(args.text, config);
          const stageNames = result.stats.stageBreakdown
            .map((s) => s.stage)
            .join(" -> ");

          rows.push(
            `${level.padEnd(13)}| ${String(result.stats.compressedTokens).padEnd(7)}| -${String(result.stats.reductionPercent + "%").padEnd(10)}| ${stageNames}`
          );
        }

        rows.push("");
        rows.push("Per-stage breakdown (aggressive):");

        const aggressiveConfig: PipelineConfig = {
          level: "aggressive",
          preservePatterns: [],
          tokenizer,
          dictionary,
        };
        const aggressiveResult = await pipeline.compress(args.text, aggressiveConfig);
        for (const s of aggressiveResult.stats.stageBreakdown) {
          rows.push(
            `  ${s.stage}: ${s.tokensIn} -> ${s.tokensOut} (-${s.reductionPercent}%, ${s.timeMs}ms)`
          );
        }

        return {
          content: [{ type: "text", text: rows.join("\n") }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Benchmark error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // -- tksq_configure --

  server.tool(
    "tksq_configure",
    "Read or update tksq configuration. " +
      "Without arguments, returns current settings. " +
      "With arguments, updates the specified settings and persists them.",
    {
      level: z
        .enum(["light", "medium", "aggressive"])
        .optional()
        .describe("Default compression level"),
      domain: z
        .enum(["general", "programming", "legal", "academic"])
        .optional()
        .describe("Default dictionary domain"),
      tokenizer: z
        .enum(["cl100k_base", "o200k_base", "approximate"])
        .optional()
        .describe("Default tokenizer"),
      preserve_patterns: z
        .array(z.string())
        .optional()
        .describe("Default preserve patterns (replaces existing)"),
      custom_substitutions: z
        .record(z.string())
        .optional()
        .describe("Custom word substitutions to add (merged with existing)"),
    },
    async (args) => {
      try {
        const hasUpdates =
          args.level !== undefined ||
          args.domain !== undefined ||
          args.tokenizer !== undefined ||
          args.preserve_patterns !== undefined ||
          args.custom_substitutions !== undefined;

        if (!hasUpdates) {
          const config = await configManager.load();
          const output = [
            "Current tksq configuration:",
            "",
            `Level: ${config.level}`,
            `Domain: ${config.domain}`,
            `Tokenizer: ${config.tokenizer}`,
            `Preserve patterns: ${config.preservePatterns.length > 0 ? config.preservePatterns.join(", ") : "(none)"}`,
            `Custom substitutions: ${Object.keys(config.customSubstitutions).length}`,
            "",
            `Config file: ${ConfigManager.getConfigPath()}`,
          ];

          if (Object.keys(config.customSubstitutions).length > 0) {
            output.push("Substitutions:");
            for (const [key, value] of Object.entries(
              config.customSubstitutions
            )) {
              output.push(`  "${key}" -> "${value}"`);
            }
          }

          return {
            content: [{ type: "text", text: output.join("\n") }],
          };
        }

        const partial: Record<string, unknown> = {};
        if (args.level !== undefined) partial.level = args.level;
        if (args.domain !== undefined) partial.domain = args.domain;
        if (args.tokenizer !== undefined) partial.tokenizer = args.tokenizer;
        if (args.preserve_patterns !== undefined)
          partial.preservePatterns = args.preserve_patterns;
        if (args.custom_substitutions !== undefined)
          partial.customSubstitutions = args.custom_substitutions;

        const updated = await configManager.update(partial);

        const output = [
          "Configuration updated:",
          "",
          `Level: ${updated.level}`,
          `Domain: ${updated.domain}`,
          `Tokenizer: ${updated.tokenizer}`,
          `Preserve patterns: ${updated.preservePatterns.length > 0 ? updated.preservePatterns.join(", ") : "(none)"}`,
          `Custom substitutions: ${Object.keys(updated.customSubstitutions).length}`,
          "",
          `Saved to: ${ConfigManager.getConfigPath()}`,
        ];

        return {
          content: [{ type: "text", text: output.join("\n") }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Config error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
