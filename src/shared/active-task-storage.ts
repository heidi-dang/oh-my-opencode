import { join } from "node:path"
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { getOpenCodeConfigDir } from "./opencode-config-dir"
import { log } from "./logger"

export interface ActiveTaskInfo {
  id: string
  sessionID: string
  description: string
  agent: string
  status: string
  startedAt: string
  progress?: {
    phase?: string
    percent?: number
    message?: string
  }
}

const STORAGE_FILENAME = "active_background_tasks.json"

function getStoragePath(): string {
  const configDir = getOpenCodeConfigDir({ binary: "opencode" })
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  return join(configDir, STORAGE_FILENAME)
}

export function saveActiveTasks(tasks: ActiveTaskInfo[]): void {
  try {
    const path = getStoragePath()
    writeFileSync(path, JSON.stringify(tasks, null, 2), "utf-8")
  } catch (err) {
    log("[active-task-storage] Failed to save active tasks:", err)
  }
}

export function readActiveTasks(): ActiveTaskInfo[] {
  try {
    const path = getStoragePath()
    if (!existsSync(path)) return []
    const content = readFileSync(path, "utf-8")
    return JSON.parse(content)
  } catch (err) {
    log("[active-task-storage] Failed to read active tasks:", err)
    return []
  }
}
