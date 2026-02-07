# tksq

Universal LLM token compression MCP server. Squeeze your tokens.

**tksq** reduces token consumption when working with LLMs by compressing text through a multi-stage pipeline. It removes filler phrases, applies concise substitutions, eliminates redundancies, and normalizes whitespace - all while preserving code blocks, URLs, and semantic meaning.

Works as an [MCP](https://modelcontextprotocol.io/) server with any compatible client: Claude Code, Cursor, VS Code, and more.

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

tksq processes text through a compression pipeline:

```
Input: 120 tokens
  -> [Cleanup]:   115 tokens (-4.2%)     # whitespace, fillers, redundancy
  -> [Semantic]:   75 tokens (-34.8%)    # phrase substitution, abbreviations
Total: 120 -> 75 tokens (37.5% saved)
```

### What gets compressed

- **Filler phrases**: "I would like to", "it is worth noting that", "basically" -> removed
- **Verbose phrases**: "in order to" -> "to", "due to the fact that" -> "because"
- **Redundancies**: "completely unique" -> "unique", "return back" -> "return"
- **Whitespace**: multiple blank lines, trailing spaces, extra spaces

### What stays untouched

- Code blocks (fenced and inline)
- URLs
- Long quoted strings
- Custom patterns you specify

## Tools

### `tksq_compress`

Compress text and get per-stage statistics.

```
Parameters:
  text       (required)  The text to compress
  level      (optional)  "light" | "medium" | "aggressive" (default: "medium")
  domain     (optional)  "general" | "programming" (default: "general")
  tokenizer  (optional)  "cl100k_base" | "o200k_base" | "approximate"
```

**Example output:**

```
Compressed text here...

---
Tokens: 450 -> 285 (-36.67%)
Chars: 1820 -> 1150
Tokenizer: cl100k_base
Level: medium | Domain: general
Changes: 23
Stages:
  Cleanup: 450 -> 380 tokens (-15.56%, 2.1ms)
  Semantic: 380 -> 285 tokens (-25%, 3.4ms)
```

### `tksq_count`

Count tokens without compressing.

```
Parameters:
  text       (required)  The text to count
  tokenizer  (optional)  Tokenizer encoding
```

### `tksq_diff`

Show word-level diff between original and compressed text.

```
Parameters:
  original    (required)  The original text
  compressed  (optional)  Text to compare (auto-compresses if omitted)
  level       (optional)  Compression level
  domain      (optional)  Dictionary domain
```

## Compression Levels

| Level | Stages | Expected Savings | Risk |
|-------|--------|-----------------|------|
| **light** | Cleanup only | 5-15% | Negligible |
| **medium** | Cleanup + Semantic | 20-40% | Low |
| **aggressive** | Cleanup + Semantic | 30-50%+ | Low-Moderate |

## Domain Dictionaries

**general** (default): Prose-focused. Removes common English filler, applies standard substitutions.

**programming**: Everything in general, plus:
- Code abbreviations: "function" -> "fn", "configuration" -> "config", "repository" -> "repo"
- Tech substitutions: "is responsible for" -> "handles", "the following code snippet" -> "this code"
- Smart identifier detection: won't abbreviate "function" inside `getFunction` or `my_function`

## Configuration

tksq stores config at:
- **Windows**: `%APPDATA%\tksq\config.json`
- **Linux/Mac**: `~/.config/tksq/config.json`

Default config:

```json
{
  "level": "medium",
  "tokenizer": "cl100k_base",
  "domain": "general",
  "preservePatterns": [],
  "customSubstitutions": {}
}
```

Add custom substitutions:

```json
{
  "customSubstitutions": {
    "microservice architecture": "MSA",
    "continuous integration": "CI"
  }
}
```

## How Much Does It Save?

Real-world examples:

| Input Type | Tokens Before | After (medium) | Savings |
|-----------|---------------|-----------------|---------|
| Verbose code review request | 450 | 285 | 36.7% |
| LLM-generated explanation | 820 | 510 | 37.8% |
| Technical documentation | 350 | 260 | 25.7% |
| Casual prose with fillers | 200 | 120 | 40.0% |

The more verbose the input, the higher the compression. LLM-generated text (which tends to be wordy) compresses particularly well.

## Development

```bash
git clone <repo-url>
cd tksq
npm install
npm run build
npm test
```

### Project Structure

```
src/
  index.ts              # Entry point (stdio MCP transport)
  server.ts             # MCP server, tool registration
  pipeline/
    Pipeline.ts         # Orchestrator
    stages/
      IStage.ts         # Types and interfaces
      CleanupStage.ts   # Whitespace, fillers, redundancy
      SemanticStage.ts  # Substitutions, abbreviations
    preserver/
      PatternPreserver.ts  # Protect code blocks, URLs
  tokenizer/
    TokenCounter.ts     # tiktoken + approximate counter
  dictionaries/
    fillers.ts          # 80+ filler phrases
    substitutions.ts    # 100+ verbose->concise mappings
    redundancies.ts     # 80+ redundant qualifier patterns
    domains/
      general.ts        # General English dictionary
      programming.ts    # Programming-specific abbreviations
    DictionaryLoader.ts # Dictionary loading and merging
  config/
    ConfigManager.ts    # Persistent user config
    defaults.ts         # Default values
  diff/
    TextDiffer.ts       # Word-level diff
```

## Roadmap

- [ ] **Phase 2**: StructuralStage (dedup, pattern collapse), ShorthandStage (telegraphic)
- [ ] **Phase 2**: `tksq_benchmark` tool for effectiveness analysis
- [ ] **Phase 2**: `tksq_configure` MCP tool
- [ ] **Phase 2**: More domain dictionaries (legal, medical, academic)
- [ ] **Phase 3**: Auto-tuning compression parameters
- [ ] **Phase 3**: Benchmark trend analysis and visualization
