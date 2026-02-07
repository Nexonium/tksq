import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_CONFIG, type TksqConfig } from "./defaults.js";

export class ConfigManager {
  private config: TksqConfig | null = null;

  static getConfigDir(): string {
    if (process.platform === "win32") {
      const appData = process.env.APPDATA;
      if (appData) {
        return join(appData, "tksq");
      }
      return join(homedir(), "AppData", "Roaming", "tksq");
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      return join(xdgConfig, "tksq");
    }
    return join(homedir(), ".config", "tksq");
  }

  static getConfigPath(): string {
    return join(ConfigManager.getConfigDir(), "config.json");
  }

  async load(): Promise<TksqConfig> {
    if (this.config) return this.config;

    try {
      const configPath = ConfigManager.getConfigPath();
      const raw = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw);

      this.config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        customSubstitutions: {
          ...DEFAULT_CONFIG.customSubstitutions,
          ...(parsed.customSubstitutions ?? {}),
        },
      };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config;
  }

  async save(config: TksqConfig): Promise<void> {
    this.config = config;
    const configDir = ConfigManager.getConfigDir();
    await mkdir(configDir, { recursive: true });
    await writeFile(
      ConfigManager.getConfigPath(),
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  }

  async update(partial: Partial<TksqConfig>): Promise<TksqConfig> {
    const current = await this.load();
    const updated: TksqConfig = { ...current, ...partial };

    if (partial.customSubstitutions) {
      updated.customSubstitutions = {
        ...current.customSubstitutions,
        ...partial.customSubstitutions,
      };
    }

    await this.save(updated);
    return updated;
  }
}
