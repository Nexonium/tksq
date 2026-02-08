import { describe, it, expect } from "vitest";
import { Pipeline } from "../../src/pipeline/Pipeline.js";
import { DictionaryLoader } from "../../src/dictionaries/DictionaryLoader.js";
import { LanguageRegistry } from "../../src/dictionaries/languages/registry.js";
import type { PipelineConfig } from "../../src/pipeline/stages/IStage.js";

describe("Multilingual support", () => {
  const pipeline = new Pipeline();

  describe("LanguageRegistry", () => {
    it("has English and Russian packs", () => {
      const langs = LanguageRegistry.availableLanguages();
      expect(langs).toContain("en");
      expect(langs).toContain("ru");
    });

    it("returns English pack with latin script", () => {
      const pack = LanguageRegistry.get("en");
      expect(pack.code).toBe("en");
      expect(pack.script).toBe("latin");
      expect(pack.fillers.length).toBeGreaterThan(0);
    });

    it("returns Russian pack with cyrillic script", () => {
      const pack = LanguageRegistry.get("ru");
      expect(pack.code).toBe("ru");
      expect(pack.script).toBe("cyrillic");
      expect(pack.fillers.length).toBeGreaterThan(0);
    });

    it("throws on unknown language", () => {
      expect(() => LanguageRegistry.get("fr" as any)).toThrow("Unknown language");
    });
  });

  describe("DictionaryLoader with language", () => {
    it("loads English general dictionary", () => {
      const dict = DictionaryLoader.load("general", "en");
      expect(dict.language).toBe("en");
      expect(dict.script).toBe("latin");
      expect(dict.shorthand.contractions.length).toBeGreaterThan(0);
    });

    it("loads Russian general dictionary", () => {
      const dict = DictionaryLoader.load("general", "ru");
      expect(dict.language).toBe("ru");
      expect(dict.script).toBe("cyrillic");
      expect(dict.fillers.length).toBeGreaterThan(0);
      expect(dict.shorthand.contractions.length).toBe(0);
      expect(dict.shorthand.articles).toBeNull();
    });

    it("applies domain overlay to Russian", () => {
      const dict = DictionaryLoader.load("programming", "ru");
      expect(dict.language).toBe("ru");
      expect(dict.abbreviations.size).toBeGreaterThan(0);
      expect(dict.abbreviations.get("function")).toBe("fn");
    });
  });

  describe("Russian text compression", () => {
    it("removes Russian filler phrases", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "light",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Как бы это важный момент в нашей работе";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).not.toContain("как бы");
    });

    it("applies Russian substitutions on medium", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "В настоящее время мы работаем над проектом";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).not.toContain("в настоящее время");
      expect(result.compressed.toLowerCase()).toContain("сейчас");
    });

    it("achieves non-zero reduction on Russian text", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input =
        "В настоящее время, по сути, необходимо отметить, что данный проект " +
        "как бы представляет собой достаточно важный элемент. " +
        "Тем не менее, в конечном счёте, с точки зрения качества, " +
        "на самом деле результат является положительным.";

      const result = await pipeline.compress(input, config);
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
    });

    it("applies standard Russian abbreviations", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Нам нужны данные, то есть таблицы и так далее";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).toContain("т.е.");
      expect(result.compressed).toContain("т.д.");
    });

    it("simplifies bureaucratic prepositions", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "В связи с тем что проект задерживается, при условии что бюджет позволяет";
      const result = await pipeline.compress(input, config);
      expect(result.compressed.toLowerCase()).toContain("т.к.");
      expect(result.compressed.toLowerCase()).toContain("если");
      expect(result.compressed.toLowerCase()).not.toContain("в связи с тем что");
    });

    it("reduces paired synonyms (pleonasms)", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Задача целиком и полностью выполнена, результат самый лучший";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).not.toContain("целиком и полностью");
      expect(result.compressed).toContain("полностью");
      expect(result.compressed).not.toContain("самый лучший");
      expect(result.compressed).toContain("лучший");
    });

    it("replaces bureaucratic adjectives", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Вышеуказанный документ описывает данный процесс";
      const result = await pipeline.compress(input, config);
      expect(result.compressed.toLowerCase()).toContain("указанный");
      expect(result.compressed.toLowerCase()).not.toContain("вышеуказанный");
      expect(result.compressed.toLowerCase()).toContain("этот");
      expect(result.compressed.toLowerCase()).not.toContain("данный");
    });

    it("elides pronouns before 1st person verbs on aggressive", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Я думаю, что это правильно. Мы считаем это верным.";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).not.toMatch(/\bЯ думаю\b/i);
      expect(result.compressed.toLowerCase()).toContain("думаю");
      expect(result.compressed).not.toMatch(/\bМы считаем\b/i);
      expect(result.compressed.toLowerCase()).toContain("считаем");
    });

    it("does not elide pronouns on medium", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "medium",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Я думаю, что это правильно";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).toContain("думаю");
    });

    it("compresses patronymics to initials on aggressive", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Александр Сергеевич написал это произведение";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).toContain("А.С.");
      expect(result.compressed).not.toContain("Александр Сергеевич");
    });

    it("compresses female patronymics", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input = "Анна Ивановна утвердила документ";
      const result = await pipeline.compress(input, config);
      expect(result.compressed).toContain("А.И.");
      expect(result.compressed).not.toContain("Анна Ивановна");
    });

    it("achieves significant reduction on bureaucratic text", async () => {
      const dict = DictionaryLoader.load("general", "ru");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input =
        "В связи с тем что в настоящее время осуществление контроля " +
        "за выполнением вышеуказанных мероприятий является одним из " +
        "наиболее важных направлений деятельности, доводим до вашего " +
        "сведения, что принятие решения по данному вопросу будет " +
        "произведено в конечном счёте.";

      const result = await pipeline.compress(input, config);
      expect(result.stats.reductionPercent).toBeGreaterThan(20);
    });
  });

  describe("English compression unchanged", () => {
    it("still compresses English text correctly", async () => {
      const dict = DictionaryLoader.load("general", "en");
      const config: PipelineConfig = {
        level: "aggressive",
        preservePatterns: [],
        tokenizer: "approximate",
        dictionary: dict,
      };

      const input =
        "Basically, in order to understand this, it is important to note that " +
        "the implementation will not work without the necessary changes.";

      const result = await pipeline.compress(input, config);
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
      expect(result.compressed).toContain("won't");
    });
  });
});
