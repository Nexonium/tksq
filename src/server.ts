import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Pipeline } from "./pipeline/Pipeline.js";
import { DictionaryLoader, type DomainName } from "./dictionaries/DictionaryLoader.js";
import { ConfigManager } from "./config/ConfigManager.js";
import { TextDiffer } from "./diff/TextDiffer.js";
import { TokenCounterFactory } from "./tokenizer/TokenCounter.js";
import { LanguageDetector } from "./language/LanguageDetector.js";
import { PhraseStore } from "./learning/PhraseStore.js";
import { PhraseTracker } from "./learning/PhraseTracker.js";
import type { LanguageCode } from "./dictionaries/languages/types.js";
import type { LanguageSetting } from "./config/defaults.js";
import type {
  CompressionLevel,
  TokenizerType,
  PipelineConfig,
} from "./pipeline/stages/IStage.js";

function resolveLanguage(setting: LanguageSetting, text: string): LanguageCode {
  if (setting === "auto") {
    return LanguageDetector.detect(text);
  }
  return setting;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tksq",
    version: "1.3.0",
  });

  const pipeline = new Pipeline();
  const configManager = new ConfigManager();
  const differ = new TextDiffer();
  const phraseStore = new PhraseStore();
  let tracker: PhraseTracker | null = null;

  async function getTracker(): Promise<PhraseTracker> {
    if (!tracker) {
      const config = await configManager.load();
      tracker = new PhraseTracker(phraseStore, config.learning);
      await phraseStore.incrementSessionCount();
    }
    return tracker;
  }

  async function getPromotedSubstitutions(
    userCustom: Record<string, string>
  ): Promise<Record<string, string>> {
    const promoted = await phraseStore.getPromoted();
    const merged = { ...promoted, ...userCustom };
    return merged;
  }

  // Flush learned data on process exit
  const flushAndExit = async () => {
    await phraseStore.flush();
    process.exit(0);
  };
  process.on("SIGINT", flushAndExit);
  process.on("SIGTERM", flushAndExit);

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
      language: z
        .enum(["auto", "en", "ru"])
        .optional()
        .describe(
          "Language for compression dictionaries. auto=detect from text (default), en=English, ru=Russian"
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
        const langSetting: LanguageSetting = args.language ?? userConfig.language;
        const language = resolveLanguage(langSetting, args.text);

        // Merge promoted patterns with user custom substitutions
        const customSubs = await getPromotedSubstitutions(
          userConfig.customSubstitutions
        );

        const dictionary = DictionaryLoader.load(
          domain,
          language,
          Object.keys(customSubs).length > 0 ? customSubs : undefined
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

        // Track learning stats
        if (userConfig.learning.enabled) {
          const tokensSaved =
            result.stats.originalTokens - result.stats.compressedTokens;
          await phraseStore.updateStats(
            tokensSaved,
            result.stats.originalChars,
            result.stats.compressedChars
          );

          // Analyze text for repeating phrases
          const t = await getTracker();
          await t.analyzeText(args.text);
          await phraseStore.save();
        }

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
          `Level: ${level} | Domain: ${domain} | Language: ${language}`,
          `Changes: ${result.allChanges.length}`,
          "Stages:",
          stageBreakdown,
        ];

        // Add learning suggestions footer
        if (userConfig.learning.enabled) {
          const t = await getTracker();
          const suggestions = await t.getReadySuggestions();
          if (suggestions.length > 0) {
            output.push("");
            output.push(
              `Learning: ${suggestions.length} pattern(s) ready to promote. Use tksq_learn to review.`
            );
          }
        }

        return {
          content: [{ type: "text", text: output.join("\n") }],
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
      language: z
        .enum(["auto", "en", "ru"])
        .optional()
        .describe(
          "Language for compression dictionaries (only used if compressed is omitted)"
        ),
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
          const langSetting: LanguageSetting = args.language ?? userConfig.language;
          const language = resolveLanguage(langSetting, args.original);

          const dictionary = DictionaryLoader.load(
            domain,
            language,
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
      language: z
        .enum(["auto", "en", "ru"])
        .optional()
        .describe(
          "Language for compression dictionaries. auto=detect from text (default), en=English, ru=Russian"
        ),
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
        const langSetting: LanguageSetting = args.language ?? userConfig.language;
        const language = resolveLanguage(langSetting, args.text);

        const dictionary = DictionaryLoader.load(domain, language);
        const levels: CompressionLevel[] = ["light", "medium", "aggressive"];
        const rows: string[] = [];

        const counter = await TokenCounterFactory.createReady(tokenizer);
        const originalTokens = counter.count(args.text);

        rows.push(`Original: ${originalTokens} tokens (${args.text.length} chars)`);
        rows.push(`Domain: ${domain} | Language: ${language} | Tokenizer: ${tokenizer}`);
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
      language: z
        .enum(["auto", "en", "ru"])
        .optional()
        .describe(
          "Default language. auto=detect from text (default), en=English, ru=Russian"
        ),
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
          args.language !== undefined ||
          args.tokenizer !== undefined ||
          args.preserve_patterns !== undefined ||
          args.custom_substitutions !== undefined;

        if (!hasUpdates) {
          const config = await configManager.load();
          const promoted = await phraseStore.getPromoted();
          const output = [
            "Current tksq configuration:",
            "",
            `Level: ${config.level}`,
            `Domain: ${config.domain}`,
            `Language: ${config.language}`,
            `Tokenizer: ${config.tokenizer}`,
            `Preserve patterns: ${config.preservePatterns.length > 0 ? config.preservePatterns.join(", ") : "(none)"}`,
            `Custom substitutions: ${Object.keys(config.customSubstitutions).length}`,
            `Promoted patterns: ${Object.keys(promoted).length}`,
            `Learning: ${config.learning.enabled ? "enabled" : "disabled"} (min freq: ${config.learning.minFrequency}, auto-promote: ${config.learning.autoPromote})`,
            "",
            `Config file: ${ConfigManager.getConfigPath()}`,
            `Learned data: ${PhraseStore.getStorePath()}`,
          ];

          if (Object.keys(config.customSubstitutions).length > 0) {
            output.push("Substitutions:");
            for (const [key, value] of Object.entries(
              config.customSubstitutions
            )) {
              output.push(`  "${key}" -> "${value}"`);
            }
          }

          if (Object.keys(promoted).length > 0) {
            output.push("Promoted:");
            for (const [key, value] of Object.entries(promoted)) {
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
        if (args.language !== undefined) partial.language = args.language;
        if (args.tokenizer !== undefined) partial.tokenizer = args.tokenizer;
        if (args.preserve_patterns !== undefined)
          partial.preservePatterns = args.preserve_patterns;
        if (args.custom_substitutions !== undefined)
          partial.customSubstitutions = args.custom_substitutions;

        const updated = await configManager.update(partial);

        // Reset tracker so it picks up new learning config
        tracker = null;

        const output = [
          "Configuration updated:",
          "",
          `Level: ${updated.level}`,
          `Domain: ${updated.domain}`,
          `Language: ${updated.language}`,
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

  // -- tksq_learn --

  server.tool(
    "tksq_learn",
    "Manage the learning buffer. List candidate patterns discovered from usage, " +
      "promote them to active substitutions, reject false positives, or add manual patterns. " +
      "Use 'stats' action to see compression statistics.",
    {
      action: z
        .enum(["list", "promote", "reject", "add", "reset", "stats"])
        .describe(
          "Action: list=show candidates, promote=activate a candidate, reject=remove candidate, " +
            "add=manually add a pattern, reset=clear all learned data, stats=show statistics"
        ),
      phrase: z
        .string()
        .optional()
        .describe("Phrase to promote/reject/add"),
      replacement: z
        .string()
        .optional()
        .describe("Replacement for promote/add action"),
    },
    async (args) => {
      try {
        switch (args.action) {
          case "list": {
            const candidates = await phraseStore.getCandidates();
            if (candidates.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No candidate patterns yet. Use tksq_compress to analyze text and discover patterns.",
                  },
                ],
              };
            }

            const userConfig = await configManager.load();
            const lines = [
              `Candidate patterns (${candidates.length}, min frequency for promotion: ${userConfig.learning.minFrequency}):`,
              "",
            ];
            for (const c of candidates) {
              const ready = c.count >= userConfig.learning.minFrequency && c.suggestedReplacement;
              const status = ready ? " [READY]" : "";
              const suggestion = c.suggestedReplacement
                ? ` -> "${c.suggestedReplacement}"`
                : "";
              lines.push(
                `  "${c.phrase}" (x${c.count})${suggestion}${status}`
              );
            }

            const promoted = await phraseStore.getPromoted();
            if (Object.keys(promoted).length > 0) {
              lines.push("");
              lines.push(`Promoted patterns (${Object.keys(promoted).length}):`);
              for (const [key, value] of Object.entries(promoted)) {
                lines.push(`  "${key}" -> "${value}"`);
              }
            }

            return {
              content: [{ type: "text", text: lines.join("\n") }],
            };
          }

          case "promote": {
            if (!args.phrase) {
              return {
                content: [
                  { type: "text", text: "Error: 'phrase' is required for promote action." },
                ],
                isError: true,
              };
            }

            const candidates = await phraseStore.getCandidates();
            const key = args.phrase.toLowerCase();
            const candidate = candidates.find(
              (c) => c.phrase.toLowerCase() === key
            );

            const replacement =
              args.replacement ??
              candidate?.suggestedReplacement ??
              null;

            if (!replacement) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: no replacement available. Provide one via 'replacement' parameter.",
                  },
                ],
                isError: true,
              };
            }

            await phraseStore.promote(args.phrase, replacement);
            return {
              content: [
                {
                  type: "text",
                  text: `Promoted: "${args.phrase}" -> "${replacement}"\nThis pattern will now be applied during compression.`,
                },
              ],
            };
          }

          case "reject": {
            if (!args.phrase) {
              return {
                content: [
                  { type: "text", text: "Error: 'phrase' is required for reject action." },
                ],
                isError: true,
              };
            }

            const removed = await phraseStore.reject(args.phrase);
            return {
              content: [
                {
                  type: "text",
                  text: removed
                    ? `Rejected: "${args.phrase}" removed from candidates.`
                    : `"${args.phrase}" not found in candidates.`,
                },
              ],
            };
          }

          case "add": {
            if (!args.phrase || !args.replacement) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: both 'phrase' and 'replacement' are required for add action.",
                  },
                ],
                isError: true,
              };
            }

            await phraseStore.promote(args.phrase, args.replacement);
            return {
              content: [
                {
                  type: "text",
                  text: `Added: "${args.phrase}" -> "${args.replacement}"\nThis pattern will be applied during compression.`,
                },
              ],
            };
          }

          case "reset": {
            await phraseStore.reset();
            tracker = null;
            return {
              content: [
                {
                  type: "text",
                  text: "Learning data reset. All candidates, promoted patterns, and stats cleared.",
                },
              ],
            };
          }

          case "stats": {
            const stats = await phraseStore.getStats();
            const candidates = await phraseStore.getCandidates();
            const promoted = await phraseStore.getPromoted();

            const avgReduction =
              stats.totalCharsOriginal > 0
                ? (
                    ((stats.totalCharsOriginal - stats.totalCharsCompressed) /
                      stats.totalCharsOriginal) *
                    100
                  ).toFixed(1)
                : "0";

            const lines = [
              "Learning Statistics:",
              "",
              `Sessions: ${stats.sessionCount}`,
              `Total compressions: ${stats.totalCompressions}`,
              `Total tokens saved: ${stats.totalTokensSaved}`,
              `Total chars processed: ${stats.totalCharsOriginal.toLocaleString()}`,
              `Average reduction: ${avgReduction}%`,
              "",
              `Candidates: ${candidates.length}`,
              `Promoted: ${Object.keys(promoted).length}`,
              "",
              `Data file: ${PhraseStore.getStorePath()}`,
            ];

            return {
              content: [{ type: "text", text: lines.join("\n") }],
            };
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Learn error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // -- tksq_dashboard --

  server.tool(
    "tksq_dashboard",
    "Show a comprehensive dashboard with session stats, all-time stats, " +
      "configuration overview, learned patterns, and dictionary sizes. " +
      "Provides a quick overview of tksq's state and effectiveness.",
    {},
    async () => {
      try {
        const userConfig = await configManager.load();
        const stats = await phraseStore.getStats();
        const candidates = await phraseStore.getCandidates();
        const promoted = await phraseStore.getPromoted();

        const avgReduction =
          stats.totalCharsOriginal > 0
            ? (
                ((stats.totalCharsOriginal - stats.totalCharsCompressed) /
                  stats.totalCharsOriginal) *
                100
              ).toFixed(1)
            : "0";

        const readyCandidates = candidates.filter(
          (c) =>
            c.count >= userConfig.learning.minFrequency &&
            c.suggestedReplacement !== null
        );

        const lines = [
          "=== tksq Dashboard ===",
          "",
          "-- All-Time Stats --",
          `Sessions: ${stats.sessionCount}`,
          `Compressions: ${stats.totalCompressions}`,
          `Tokens saved: ${stats.totalTokensSaved}`,
          `Chars processed: ${stats.totalCharsOriginal.toLocaleString()}`,
          `Avg reduction: ${avgReduction}%`,
          "",
          "-- Configuration --",
          `Level: ${userConfig.level} | Domain: ${userConfig.domain} | Language: ${userConfig.language}`,
          `Tokenizer: ${userConfig.tokenizer}`,
          `Learning: ${userConfig.learning.enabled ? "ON" : "OFF"} (min freq: ${userConfig.learning.minFrequency}, auto-promote: ${userConfig.learning.autoPromote ? "ON" : "OFF"})`,
          `Custom substitutions: ${Object.keys(userConfig.customSubstitutions).length}`,
          `Preserve patterns: ${userConfig.preservePatterns.length}`,
          "",
          "-- Learning Buffer --",
          `Candidates: ${candidates.length} (${readyCandidates.length} ready to promote)`,
          `Promoted: ${Object.keys(promoted).length}`,
        ];

        if (readyCandidates.length > 0) {
          lines.push("");
          lines.push("Ready to promote:");
          for (const c of readyCandidates.slice(0, 10)) {
            lines.push(
              `  "${c.phrase}" -> "${c.suggestedReplacement}" (x${c.count})`
            );
          }
          if (readyCandidates.length > 10) {
            lines.push(`  ... and ${readyCandidates.length - 10} more`);
          }
        }

        if (Object.keys(promoted).length > 0) {
          lines.push("");
          lines.push("Active promoted patterns:");
          const entries = Object.entries(promoted);
          for (const [key, value] of entries.slice(0, 10)) {
            lines.push(`  "${key}" -> "${value}"`);
          }
          if (entries.length > 10) {
            lines.push(`  ... and ${entries.length - 10} more`);
          }
        }

        // Dictionary info
        const languages = ["en", "ru"] as const;
        lines.push("");
        lines.push("-- Dictionary Info --");
        for (const lang of languages) {
          const dict = DictionaryLoader.load(userConfig.domain, lang);
          lines.push(
            `  ${lang}: ${dict.abbreviations.size} abbreviations, ` +
              `${dict.substitutions.size} substitutions, ` +
              `${dict.fillers.length} fillers, ` +
              `${dict.redundancies.length} redundancies`
          );
        }

        lines.push("");
        lines.push(`Config: ${ConfigManager.getConfigPath()}`);
        lines.push(`Learned: ${PhraseStore.getStorePath()}`);

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Dashboard error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
