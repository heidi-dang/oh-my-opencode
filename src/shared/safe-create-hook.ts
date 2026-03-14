import { log } from "./logger"

interface SafeCreateHookOptions {
  enabled?: boolean
}

const globalHookFailures: string[] = []
const SAFE_MODE_THRESHOLD = 3

export function isInSafeMode(): boolean {
  return globalHookFailures.length >= SAFE_MODE_THRESHOLD
}

export function getSafeModeFailures(): ReadonlyArray<string> {
  return globalHookFailures
}

export function safeCreateHook<T>(
  name: string,
  factory: () => T,
  options?: SafeCreateHookOptions,
): T | null {
  const enabled = options?.enabled ?? true

  if (isInSafeMode()) {
    log(`[safe-mode] Skipping hook '${name}' — SafeMode active (${globalHookFailures.length} prior failures: ${globalHookFailures.join(", ")})`)
    return null
  }

  if (!enabled) {
    return factory() ?? null
  }

  try {
    return factory() ?? null
  } catch (error) {
    globalHookFailures.push(name)
    log(`[safe-create-hook] Hook creation failed: ${name}`, { error })

    if (globalHookFailures.length >= SAFE_MODE_THRESHOLD) {
      log(`[safe-mode] ACTIVATED — ${globalHookFailures.length} hooks failed during creation: [${globalHookFailures.join(", ")}]. All subsequent hooks will be skipped.`)
    }

    return null
  }
}

export async function safeCreateHookAsync<T>(
  name: string,
  factory: () => Promise<T>,
  options?: SafeCreateHookOptions,
): Promise<T | null> {
  const enabled = options?.enabled ?? true

  if (isInSafeMode()) {
    log(`[safe-mode] Skipping hook '${name}' — SafeMode active (${globalHookFailures.length} prior failures: ${globalHookFailures.join(", ")})`)
    return null
  }

  if (!enabled) {
    return (await factory()) ?? null
  }

  try {
    return (await factory()) ?? null
  } catch (error) {
    globalHookFailures.push(name)
    log(`[safe-create-hook] Hook creation failed: ${name}`, { error })

    if (globalHookFailures.length >= SAFE_MODE_THRESHOLD) {
      log(`[safe-mode] ACTIVATED — ${globalHookFailures.length} hooks failed during creation: [${globalHookFailures.join(", ")}]. All subsequent hooks will be skipped.`)
    }

    return null
  }
}
