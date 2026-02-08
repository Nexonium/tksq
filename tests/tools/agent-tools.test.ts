import { describe, it, expect, vi } from "vitest";
import { createServer } from "../../src/server.js";

// Mock fs for PhraseStore
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

function getToolHandler(name: string) {
  const server = createServer();
  const tools = (server as any)._registeredTools;
  return tools[name].handler;
}

describe("Agent orchestration tools", () => {
  describe("tksq_agent_prompt", () => {
    it("returns child default prompt", async () => {
      const handler = getToolHandler("tksq_agent_prompt");
      const result = await handler({ role: "child" }, {});
      const text = result.content[0].text;
      expect(text).toContain("Token Optimization Protocol");
      expect(text).toContain("tksq_pack");
      expect(text).toContain("parent agent");
    });

    it("returns child aggressive prompt", async () => {
      const handler = getToolHandler("tksq_agent_prompt");
      const result = await handler({ role: "child", style: "aggressive" }, {});
      const text = result.content[0].text;
      expect(text).toContain("Aggressive");
      expect(text).toContain("Minimize token usage");
    });

    it("returns parent default prompt", async () => {
      const handler = getToolHandler("tksq_agent_prompt");
      const result = await handler({ role: "parent" }, {});
      const text = result.content[0].text;
      expect(text).toContain("Multi-Agent Token Optimization");
      expect(text).toContain("tksq_dashboard");
    });

    it("falls back to default style for parent", async () => {
      const handler = getToolHandler("tksq_agent_prompt");
      const result = await handler(
        { role: "parent", style: "aggressive" },
        {}
      );
      const text = result.content[0].text;
      expect(text).toContain("Multi-Agent Token Optimization");
    });
  });

  describe("tksq_pack", () => {
    it("compresses text and returns packed format", async () => {
      const handler = getToolHandler("tksq_pack");

      const verboseText =
        "In order to ensure that the implementation is correct, " +
        "it is important to note that we need to basically verify " +
        "that the configuration is set up properly. Furthermore, " +
        "it is worth mentioning that the documentation should be updated accordingly.";

      const result = await handler({ text: verboseText }, {});
      const text = result.content[0].text;

      expect(text).toContain("[packed:");
      expect(text).toContain("tokens");
      // Should NOT contain verbose stats like tksq_compress does
      expect(text).not.toContain("Stages:");
      expect(text).not.toContain("Changes:");
      // Compressed body should be shorter
      const packedBody = text.split("\n\n[packed:")[0];
      expect(packedBody.length).toBeLessThan(verboseText.length);
    });

    it("preserves inline code and file paths", async () => {
      const handler = getToolHandler("tksq_pack");

      const textWithCode =
        "Basically, the function implementation is as follows: " +
        "`calculateTotal(items)` in the file `src/utils/calc.ts:42`. " +
        "It is important to note that this function works correctly.";

      const result = await handler({ text: textWithCode }, {});
      const text = result.content[0].text;

      expect(text).toContain("`calculateTotal(items)`");
      expect(text).toContain("src/utils/calc.ts:42");
    });

    it("supports aggressive level", async () => {
      const handler = getToolHandler("tksq_pack");

      const verboseText =
        "It is important to note that in order to ensure that " +
        "the implementation is basically correct and functional, " +
        "we need to verify all the various aspects of the system. " +
        "Furthermore, it is worth mentioning that we should also " +
        "take into consideration the performance implications.";

      const mediumResult = await handler(
        { text: verboseText, level: "medium" },
        {}
      );
      const aggressiveResult = await handler(
        { text: verboseText, level: "aggressive" },
        {}
      );

      const mediumBody =
        mediumResult.content[0].text.split("\n\n[packed:")[0];
      const aggressiveBody =
        aggressiveResult.content[0].text.split("\n\n[packed:")[0];

      expect(aggressiveBody.length).toBeLessThanOrEqual(mediumBody.length);
    });

    it("works with Russian text", async () => {
      const handler = getToolHandler("tksq_pack");

      const russianText =
        "В соответствии с действующим законодательством, необходимо " +
        "осуществить проверку всех компонентов системы. По сути дела, " +
        "это является обязательным требованием.";

      const result = await handler(
        { text: russianText, language: "ru" },
        {}
      );
      const text = result.content[0].text;

      expect(text).toContain("[packed:");
      expect(result.isError).toBeUndefined();
    });

    it("includes token stats in footer", async () => {
      const handler = getToolHandler("tksq_pack");

      const result = await handler(
        { text: "It is important to note that basically we should verify everything." },
        {}
      );
      const text = result.content[0].text;

      // Footer format: [packed: X->Y tokens, -Z%]
      expect(text).toMatch(/\[packed: \d+->\d+ tokens, -\d+(\.\d+)?%\]/);
    });
  });

  describe("tool registration", () => {
    it("registers all 9 tools", () => {
      const server = createServer();
      const tools = (server as any)._registeredTools;
      const toolNames = Object.keys(tools);

      expect(toolNames).toContain("tksq_compress");
      expect(toolNames).toContain("tksq_count");
      expect(toolNames).toContain("tksq_diff");
      expect(toolNames).toContain("tksq_benchmark");
      expect(toolNames).toContain("tksq_configure");
      expect(toolNames).toContain("tksq_learn");
      expect(toolNames).toContain("tksq_dashboard");
      expect(toolNames).toContain("tksq_agent_prompt");
      expect(toolNames).toContain("tksq_pack");
      expect(toolNames.length).toBe(9);
    });
  });
});
