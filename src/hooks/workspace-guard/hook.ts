import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { isAbsolute, normalize, resolve } from "path"
import { execSync } from "child_process"
import { log } from "../../shared"

export function createWorkspaceGuardHook(ctx: PluginInput): Hooks {
  let repoRoot: string | null = null
  let repoRemote: string | null = null
  let repoBranch: string | null = null
  let isConfirmed = false

  const resolveRepoIdentity = () => {
    try {
      if (repoRoot) return
      repoRoot = execSync("git rev-parse --show-toplevel", { cwd: ctx.directory, encoding: "utf-8" }).trim()
      repoRemote = execSync("git remote get-url origin", { cwd: ctx.directory, encoding: "utf-8" }).trim()
      repoBranch = execSync("git branch --show-current", { cwd: ctx.directory, encoding: "utf-8" }).trim()
      log("[workspace-guard] Resolved repo identity:", { repoRoot, repoRemote, repoBranch })
    } catch (err) {
      log("[workspace-guard] Failed to resolve repo identity:", err)
    }
  }

  const printRepoIdentity = (prefix = "") => {
    resolveRepoIdentity()
    console.log(`${prefix}[WORKSPACE IDENTITY]
  Path:   ${repoRoot || "Unknown"}
  Remote: ${repoRemote || "Unknown"}
  Branch: ${repoBranch || "Unknown"}`)
  }

  const isPathInRepo = (filePath: string): boolean => {
    resolveRepoIdentity()
    if (!repoRoot) return true
    const absolutePath = isAbsolute(filePath) ? normalize(filePath) : resolve(ctx.directory, filePath)
    return absolutePath.startsWith(repoRoot)
  }

  const extractTargets = (text: string): string[] => {
    const targets = new Set<string>()
    const regex = /([\w./-]+\.\w+)|([A-Z][\w]{3,})|([a-z]+(?:_[a-z]+)+)/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const t = match[0]
      if (t.length > 3 && !t.includes("http")) {
        targets.add(t)
      }
    }
    return Array.from(targets)
  }

  const verifyTargets = (targets: string[]) => {
    resolveRepoIdentity()
    if (!repoRoot) return

    for (const target of targets) {
      const resolvedPath = resolve(repoRoot, target)
      if (existsSync(resolvedPath)) continue

      try {
        const searchResult = execSync(`grep -rW "${target}" . | head -n 1`, { 
          cwd: repoRoot, 
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"] 
        }).trim()
        if (searchResult) continue
      } catch {
        // grep error or not found
      }

      throw new Error(`[WORKSPACE GUARD] PREFLIGHT FAILED
The target "${target}" could not be found in the current repository.

Repository: ${repoRoot}
Branch: ${repoBranch}

ACTION REQUIRED:
1. Verify if you are in the correct repository.
2. If this is the wrong workspace, ask the user to switch.
3. If the file exists but is under a different name, clarify with the user.
4. DO NOT PROCEED without explicit user confirmation if you are unsure.`)
    }
  }

  return {
    "chat.message": async (input: any) => {
      const parts = input.message?.parts ?? []
      const text = parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
      const targets = extractTargets(text)
      if (targets.length > 0) {
        log("[workspace-guard] Preflight checking targets:", targets)
        verifyTargets(targets)
      }
    },
    "tool.execute.before": async (input, output) => {
      const toolName = input.tool?.toLowerCase()
      const args = output.args as any

      const writeTools = ["write", "edit", "bash", "interactive_bash", "git"]
      if (writeTools.includes(toolName || "")) {
        printRepoIdentity(`[PRE-WRITE] Tool: ${toolName}\n`)
        
        if (toolName === "git") {
          const gitArgs = args?.args || []
          const isDestructive = ["remote", "push", "commit", "checkout", "branch", "merge", "rebase"].some(a => gitArgs.includes(a))
          if (isDestructive && !isConfirmed) {
            throw new Error(`[WORKSPACE GUARD] EXPLICIT CONFIRMATION REQUIRED
You are attempting a git write action (${gitArgs.join(" ")}) in:
Repo: ${repoRoot}
Branch: ${repoBranch}

You MUST ask the user: "Am I in the correct repository for this task?"`)
          }
        }
        
        if (toolName === "bash" || toolName === "interactive_bash") {
          const command = args?.command || ""
          if (command.includes("git remote set-url") || command.includes("rm -rf") || command.includes("push")) {
            if (!isConfirmed) {
              throw new Error(`[WORKSPACE GUARD] EXPLICIT CONFIRMATION REQUIRED for: ${command}`)
            }
          }
        }
      }

      const pathKeys = ["path", "filePath", "file_path", "targetPath", "TargetFile", "AbsolutePath", "SearchPath", "DirectoryPath", "SearchDirectory"]
      const pathsToVerify: string[] = []
      for (const key of pathKeys) {
        if (args && args[key] && typeof args[key] === "string") {
          pathsToVerify.push(args[key])
        }
      }

      for (const filePath of pathsToVerify) {
        const resolvedPath = isAbsolute(filePath) ? normalize(filePath) : resolve(ctx.directory, filePath)
        if (!existsSync(resolvedPath)) {
          resolveRepoIdentity()
          throw new Error(`[WORKSPACE GUARD] FILE NOT FOUND: "${filePath}" in ${repoRoot}`)
        }
        if (!isPathInRepo(resolvedPath)) {
          throw new Error(`[WORKSPACE GUARD] CROSS-REPO ACCESS BLOCKED: "${filePath}" is outside ${repoRoot}`)
        }
      }
    },
    event: async ({ event }: { event: { type: string; properties?: any } }) => {
      if (event.type === "workspace.confirmed") {
        isConfirmed = true
        log("[workspace-guard] User explicitly confirmed workspace.")
      }
    }
  }
}
