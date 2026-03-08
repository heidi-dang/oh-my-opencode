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
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/dev/assets/oh-my-opencode.schema.json",
  "new_task_system_enabled": true,
  "default_run_agent": "sisyphus",
  "hashline_edit": true,
  "model_fallback": true,
  "fallback_model": "github-copilot/gpt-5-mini",
  "disabled_skills": [],
  "disabled_hooks": [],
  "disabled_tools": [],
  "disabled_commands": [],
  "experimental": {
    "aggressive_truncation": true,
    "auto_resume": true,
    "preemptive_compaction": true,
    "truncate_all_tool_outputs": true,
    "task_system": true,
    "safe_hook_creation": true,
    "disable_omo_env": false,
    "hashline_edit": true,
    "model_fallback_title": true,
    "dynamic_context_pruning": {
      "enabled": true,
      "notification": "minimal",
      "turn_protection": {
        "enabled": true,
        "turns": 3
      },
      "protected_tools": [
        "task",
        "todowrite",
        "todoread",
        "lsp_rename",
        "session_read",
        "session_write",
        "session_search"
      ],
      "strategies": {
        "deduplication": {
          "enabled": true
        },
        "supersede_writes": {
          "enabled": true,
          "aggressive": false
        },
        "purge_errors": {
          "enabled": true,
          "turns": 5
        }
      }
    }
  },
  "runtime_fallback": {
    "enabled": true,
    "max_fallback_attempts": 2,
    "cooldown_seconds": 8,
    "timeout_seconds": 45,
    "notify_on_fallback": true
  },
  "background_task": {
    "defaultConcurrency": 2,
    "providerConcurrency": {
      "xai": 2,
      "github-copilot": 2,
      "opencode-go": 1
    },
    "modelConcurrency": {
      "xai/grok-4-1-fast": 2,
      "xai/grok-4-1-fast-non-reasoning": 2,
      "github-copilot/gpt-5-mini": 2,
      "opencode-go/minimax-m2.5": 1
    },
    "staleTimeoutMs": 120000,
    "messageStalenessTimeoutMs": 120000,
    "syncPollTimeoutMs": 120000
  },
  "babysitting": {
    "timeout_ms": 120000
  },
  "browser_automation_engine": {
    "provider": "playwright"
  },
  "sisyphus_agent": {
    "disabled": false,
    "default_builder_enabled": true,
    "planner_enabled": true,
    "replace_plan": false
  },
  "agents": {
    "sisyphus": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "medium",
      "textVerbosity": "medium",
      "temperature": 0.2,
      "top_p": 0.95,
      "maxTokens": 120000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 24000
      },
      "mode": "primary",
      "description": "Main orchestrator. Strong planning, routing, and repo-wide coordination."
    },
    "plan": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "high",
      "textVerbosity": "medium",
      "temperature": 0.1,
      "top_p": 0.9,
      "maxTokens": 64000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 32000
      },
      "mode": "all",
      "description": "Deterministic planner. Keep conservative and low-noise."
    },
    "build": {
      "model": "xai/grok-4-1-fast-non-reasoning",
      "fallback_models": [
        "github-copilot/gpt-5-mini",
        "opencode-go/minimax-m2.5"
      ],
      "reasoningEffort": "low",
      "textVerbosity": "low",
      "temperature": 0.1,
      "top_p": 0.9,
      "maxTokens": 64000,
      "thinking": {
        "type": "disabled"
      },
      "mode": "all",
      "description": "Fast code execution/build lane."
    },
    "hephaestus": {
      "model": "xai/grok-4-1-fast-non-reasoning",
      "fallback_models": [
        "github-copilot/gpt-5-mini",
        "opencode-go/minimax-m2.5"
      ],
      "reasoningEffort": "low",
      "textVerbosity": "low",
      "temperature": 0.1,
      "top_p": 0.9,
      "maxTokens": 64000,
      "thinking": {
        "type": "disabled"
      },
      "mode": "subagent",
      "allow_non_gpt_model": true,
      "description": "Deep worker optimized for fast implementation, not long reasoning."
    },
    "prometheus": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "high",
      "textVerbosity": "medium",
      "temperature": 0.2,
      "top_p": 0.95,
      "maxTokens": 96000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 28000
      },
      "mode": "subagent",
      "description": "Research/planning/strategy agent."
    },
    "atlas": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "medium",
      "textVerbosity": "medium",
      "temperature": 0.2,
      "top_p": 0.95,
      "maxTokens": 96000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 20000
      },
      "mode": "subagent",
      "description": "Repository analysis and architecture navigation."
    },
    "explore": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "medium",
      "textVerbosity": "medium",
      "temperature": 0.3,
      "top_p": 0.95,
      "maxTokens": 64000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 16000
      },
      "mode": "subagent",
      "description": "Codebase exploration and discovery."
    },
    "librarian": {
      "model": "github-copilot/gpt-5-mini",
      "fallback_model": "xai/grok-4-1-fast",
      "reasoningEffort": "low",
      "textVerbosity": "low",
      "temperature": 0.1,
      "top_p": 0.9,
      "maxTokens": 32000,
      "thinking": {
        "type": "disabled"
      },
      "mode": "subagent",
      "description": "Cheap summarizer and retrieval helper."
    },
    "multimodal-looker": {
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "reasoningEffort": "medium",
      "textVerbosity": "medium",
      "temperature": 0.2,
      "top_p": 0.95,
      "maxTokens": 48000,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 12000
      },
      "mode": "subagent",
      "description": "Image/screenshot-oriented inspection."
    }
  },
  "categories": {
    "fast-build": {
      "description": "High-speed implementation path",
      "model": "xai/grok-4-1-fast-non-reasoning",
      "fallback_model": "github-copilot/gpt-5-mini",
      "temperature": 0.1,
      "top_p": 0.9,
      "thinking": {
        "type": "disabled"
      },
      "reasoningEffort": "low",
      "textVerbosity": "low",
      "max_prompt_tokens": 120000
    },
    "deep-plan": {
      "description": "High-quality planning path",
      "model": "xai/grok-4-1-fast",
      "fallback_model": "github-copilot/gpt-5-mini",
      "temperature": 0.1,
      "top_p": 0.9,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 24000
      },
      "reasoningEffort": "high",
      "textVerbosity": "medium",
      "max_prompt_tokens": 160000
    },
    "cheap-helper": {
      "description": "Low-cost utility path",
      "model": "github-copilot/gpt-5-mini",
      "fallback_model": "xai/grok-4-1-fast-non-reasoning",
      "temperature": 0.1,
      "top_p": 0.9,
      "thinking": {
        "type": "disabled"
      },
      "reasoningEffort": "low",
      "textVerbosity": "low",
      "max_prompt_tokens": 48000
    }
  }
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
