/**
 * oh-my-opencode init command
 *
 * Writes the Heidi performance default config to the global oh-my-opencode config path.
 * Safe by default — does nothing if the file already exists unless --force is passed.
 *
 * Config path:
 *   Linux/macOS: ~/.config/opencode/oh-my-opencode.json
 *   Windows:     %APPDATA%\opencode\oh-my-opencode.json
 *
 * Precedence (highest → lowest):
 *   1. Project config: .opencode/oh-my-opencode.json[c]
 *   2. Global config:  ~/.config/opencode/oh-my-opencode.json  ← this file
 *   3. Plugin defaults
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import color from "picocolors"
import { getOpenCodeConfigDir } from "../../shared"

export interface InitOptions {
    force: boolean
}

const DEFAULT_CONFIG_ASSET = join(
    // Resolve relative to this compiled file's location
    // In dist/ layout: dist/cli/init/index.js → assets/default-oh-my-opencode.json
    // In source layout: src/cli/init/index.ts → assets/default-oh-my-opencode.json
    import.meta.dir,
    "../../..", // up from src/cli/init → repo root
    "assets",
    "default-oh-my-opencode.json"
)

function getGlobalConfigPath(): string {
    const configDir = getOpenCodeConfigDir({ binary: "opencode" })
    return join(configDir, "oh-my-opencode.json")
}

function loadDefaultConfig(): string {
    // Try reading from asset file first
    if (existsSync(DEFAULT_CONFIG_ASSET)) {
        return readFileSync(DEFAULT_CONFIG_ASSET, "utf-8")
    }

    // Fallback: the asset is bundled inline (for npm package consumers without assets/)
    return JSON.stringify(EMBEDDED_DEFAULT_CONFIG, null, 2) + "\n"
}

/** Embedded fallback — matches assets/default-oh-my-opencode.json exactly */
const EMBEDDED_DEFAULT_CONFIG = {
    $schema:
        "https://raw.githubusercontent.com/heidi-dang/oh-my-opencode/refs/heads/dev/assets/oh-my-opencode.schema.json",
    agents: {
        sisyphus: {
            model: "xai/grok-4-1-fast",
            ultrawork: { model: "xai/grok-4-1-fast", variant: "max" },
        },
        librarian: { model: "xai/grok-4-1-fast-non-reasoning" },
        explore: { model: "xai/grok-4-1-fast-non-reasoning" },
        oracle: { model: "xai/grok-4-1-fast", variant: "high" },
        prometheus: {
            prompt_append:
                "Prefer fast agents; only trigger ultrawork when necessary. Parallelize but avoid duplicate work.",
        },
    },
    categories: {
        quick: { model: "opencode-go/minimax-m2.5" },
        "unspecified-low": { model: "xai/grok-4-1-fast-non-reasoning" },
        "unspecified-high": { model: "xai/grok-4-1-fast", variant: "high" },
        "visual-engineering": { model: "google/gemini-3-pro-preview", variant: "high" },
        writing: { model: "xai/grok-4-1-fast-non-reasoning" },
    },
    background_task: {
        providerConcurrency: {
            xai: 8,
            "opencode-go": 6,
            opencode: 2,
            google: 1,
            openai: 1,
            anthropic: 1,
        },
        modelConcurrency: {
            "xai/grok-4-1-fast-non-reasoning": 8,
            "xai/grok-4-1-fast": 2,
            "opencode-go/minimax-m2.5": 6,
        },
    },
}

export async function initCommand(options: InitOptions): Promise<number> {
    const configPath = getGlobalConfigPath()
    const configDir = dirname(configPath)

    // Safety check: don't overwrite existing config unless --force
    if (existsSync(configPath) && !options.force) {
        console.log(
            `${color.yellow("[exists]")} ${color.dim(configPath)}`
        )
        console.log(
            color.dim(
                "Config already exists. Use --force to overwrite."
            )
        )
        return 0
    }

    // Validate JSON before writing
    let configContent: string
    try {
        configContent = loadDefaultConfig()
        JSON.parse(configContent) // validate
    } catch (err) {
        console.error(
            `${color.red("[error]")} Failed to load default config template: ${err instanceof Error ? err.message : String(err)}`
        )
        return 1
    }

    // Ensure directory exists
    try {
        mkdirSync(configDir, { recursive: true })
    } catch (err) {
        console.error(
            `${color.red("[error]")} Failed to create config directory ${configDir}: ${err instanceof Error ? err.message : String(err)}`
        )
        return 1
    }

    // Write config
    try {
        writeFileSync(configPath, configContent, "utf-8")
    } catch (err) {
        console.error(
            `${color.red("[error]")} Failed to write config: ${err instanceof Error ? err.message : String(err)}`
        )
        return 1
    }

    const verb = options.force ? "overwrote" : "wrote"
    console.log(`${color.green("[ok]")} ${verb} config to ${color.white(configPath)}`)
    console.log()
    console.log(color.dim("Next: restart opencode to apply the new configuration."))
    console.log(color.dim("Tip:  edit the file to customize models per-agent."))
    return 0
}
