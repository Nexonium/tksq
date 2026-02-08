# tksq

Universal LLM token compression MCP server. Squeeze your tokens.

**tksq** reduces token consumption when working with LLMs by compressing text through a multi-stage pipeline. It removes filler phrases, applies concise substitutions, eliminates redundancies, and normalizes whitespace — all while preserving code blocks, URLs, and semantic meaning.

Works as an [MCP](https://modelcontextprotocol.io/) server with any compatible client: Claude Code, Cursor, VS Code, and more.

## Features

- **4-stage compression pipeline**: Cleanup, Semantic, Structural, Shorthand
- **3 compression levels**: light, medium, aggressive
- **Multilingual**: English and Russian language packs with full pipeline support
- **4 domain dictionaries**: general, programming, legal, academic
- **Learning buffer**: Discovers repeating patterns, suggests new substitutions
- **Agent orchestration**: Ready-made tools for multi-agent token optimization
- **9 MCP tools** for compression, analysis, configuration, and monitoring

## Quick Start

### With Claude Code

Add to your MCP config (`.mcp.json`):

```json
{
  "mcpServers": {
    "tksq": {
      "command": "npx",
      "args": ["-y", "tksq"]
    }
  }
}
```

### With Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tksq": {
      "command": "npx",
      "args": ["-y", "tksq"]
    }
  }
}
```

## How It Works

tksq processes text through up to 4 compression stages:

```
Input: 120 tokens
  -> [Cleanup]:    115 tokens (-4.2%)    # whitespace, fillers, redundancy
  -> [Semantic]:    85 tokens (-26.1%)   # phrase substitution, abbreviations
  -> [Structural]:  82 tokens (-3.5%)    # dedup, pattern collapse
  -> [Shorthand]:   75 tokens (-8.5%)    # telegraphic, deverbal nouns
Total: 120 -> 75 tokens (37.5% saved)
```

### What gets compressed

- **Filler phrases**: "I would like to", "it is worth noting that", "basically" -> removed
- **Verbose phrases**: "in order to" -> "to", "due to the fact that" -> "because"
- **Redundancies**: "completely unique" -> "unique", "return back" -> "return"
- **Whitespace**: multiple blank lines, trailing spaces, extra spaces
- **Russian**: fillers, bureaucratic constructions, deverbal nouns, pronoun elision

### What stays untouched

- Code blocks (fenced and inline)
- URLs
- Long quoted strings
- Custom patterns you specify

## Tools

### Core Compression

#### `tksq_compress`

Compress text with full per-stage statistics.

```
Parameters:
  text              (required)  The text to compress
  level             (optional)  "light" | "medium" | "aggressive"
  domain            (optional)  "general" | "programming" | "legal" | "academic"
  language          (optional)  "auto" | "en" | "ru"
  tokenizer         (optional)  "cl100k_base" | "o200k_base" | "approximate"
  preserve_patterns (optional)  Additional regex patterns to preserve
```

#### `tksq_count`

Count tokens without compressing.

#### `tksq_diff`

Show word-level diff between original and compressed text.

#### `tksq_benchmark`

Benchmark compression across all levels side by side.

### Configuration

#### `tksq_configure`

Read or update persistent configuration. Shows current settings, custom substitutions, promoted patterns, and learning config.

### Learning

#### `tksq_learn`

Manage the learning buffer — patterns discovered from your usage.

```
Actions:
  list     Show candidate patterns with frequency counts
  promote  Activate a candidate as a compression substitution
  reject   Remove a false positive from candidates
  add      Manually add a pattern (phrase -> replacement)
  reset    Clear all learned data
  stats    Show compression statistics
```

#### `tksq_dashboard`

Comprehensive overview: all-time stats, configuration, learning buffer state, dictionary sizes.

### Agent Orchestration

#### `tksq_agent_prompt`

Get a ready-made system prompt snippet for multi-agent token optimization. Include in agent system prompts to enable pipeline-wide compression.

```
Parameters:
  role   (required)  "child" | "parent"
  style  (optional)  "default" | "aggressive"
```

#### `tksq_pack`

Compress agent output for return to parent agent. Optimized for pipelines: preserves code blocks, file paths, line numbers. Returns compressed text with minimal metadata footer.

```
Parameters:
  text      (required)  Agent output to compress
  level     (optional)  "medium" | "aggressive"
  language  (optional)  "auto" | "en" | "ru"
```

## Compression Levels

| Level | Stages | Expected Savings |
|-------|--------|-----------------|
| **light** | Cleanup | 5-15% |
| **medium** | Cleanup + Semantic | 20-40% |
| **aggressive** | All 4 stages | 30-50%+ |

## Multilingual Support

tksq auto-detects language (English/Russian) and applies the appropriate language pack.

**Russian** includes:
- 52 filler phrases, 99 substitutions, 49 redundancies
- Pronoun elision, patronymic compression, comparative expansion
- Deverbal noun compression (48 patterns across 10 verb families)
- Bureaucratic phrase simplification

## Domain Dictionaries

- **general** (default): Prose-focused filler removal and substitutions
- **programming**: Code abbreviations ("function" -> "fn", "configuration" -> "config")
- **legal**: Legal-specific terminology and substitutions
- **academic**: Academic writing patterns and abbreviations

## Learning Buffer

tksq observes your compression patterns and discovers repeating phrases. When a phrase appears frequently enough, it suggests a shorthand substitution.

```
tksq_compress("...text...")  -> tracks repeating n-grams
tksq_learn(action: "list")   -> shows candidates with counts
tksq_learn(action: "promote", phrase: "machine learning", replacement: "ML")
```

Promoted patterns are automatically applied in future compressions.

Data persists at:
- **Windows**: `%APPDATA%\tksq\learned.json`
- **Linux/Mac**: `~/.config/tksq/learned.json`

## Multi-Agent Orchestration

In multi-agent pipelines (Claude Code Task tool, etc.), tksq reduces token costs across the agent tree:

1. **Parent agent** includes `tksq_agent_prompt(role: "parent")` in its context
2. **Child agents** get `tksq_agent_prompt(role: "child")` in their system prompts
3. Before returning results, child agents call `tksq_pack` on their output
4. Parent reads compressed results directly (LLMs handle compressed text well)

Typical savings: 20-40% reduction on natural-language analysis text per agent.

## Configuration

Config file location:
- **Windows**: `%APPDATA%\tksq\config.json`
- **Linux/Mac**: `~/.config/tksq/config.json`

```json
{
  "level": "medium",
  "tokenizer": "cl100k_base",
  "domain": "general",
  "language": "auto",
  "preservePatterns": [],
  "customSubstitutions": {},
  "learning": {
    "enabled": true,
    "minFrequency": 5,
    "autoPromote": false,
    "maxCandidates": 100
  }
}
```

## Development

```bash
git clone https://github.com/Nexonium/tksq.git
cd tksq
npm install
npm run build
npm test
```

### Project Structure

```
src/
  index.ts                    # Entry point (stdio MCP transport)
  server.ts                   # MCP server, 9 tool registrations
  pipeline/
    Pipeline.ts               # Stage orchestrator
    stages/
      CleanupStage.ts         # Whitespace, fillers, redundancy
      SemanticStage.ts        # Substitutions, abbreviations
      StructuralStage.ts      # Dedup, pattern collapse
      ShorthandStage.ts       # Telegraphic, deverbal nouns
    preserver/
      PatternPreserver.ts     # Protect code blocks, URLs
  tokenizer/
    TokenCounter.ts           # tiktoken + approximate counter
  dictionaries/
    languages/
      en.ts                   # English language pack
      ru.ts                   # Russian language pack
      types.ts                # LanguagePack, ShorthandConfig
      registry.ts             # Language registry
    domains/
      general.ts, programming.ts, legal.ts, academic.ts
    DictionaryLoader.ts       # Dictionary loading and merging
  language/
    LanguageDetector.ts       # Auto language detection
    WordBoundary.ts           # Unicode-aware word boundaries
  learning/
    types.ts                  # CandidatePattern, LearnedData, LearningConfig
    PhraseStore.ts            # JSON persistence for learned patterns
    PhraseTracker.ts          # Frequency analysis, replacement suggestion
  config/
    ConfigManager.ts          # Persistent user config
    defaults.ts               # Default values
  diff/
    TextDiffer.ts             # Word-level diff
```
