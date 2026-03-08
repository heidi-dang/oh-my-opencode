import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export interface EnvValidationResult {
  missingKeys: string[]
  extraKeys: string[]
  potentialSecrets: string[]
}

export function validateEnv(directory: string): EnvValidationResult {
  const envPath = join(directory, ".env")
  const examplePath = join(directory, ".env.example")

  const missingKeys: string[] = []
  const extraKeys: string[] = []
  const potentialSecrets: string[] = []

  if (!existsSync(envPath)) {
    return { missingKeys: ["Root .env file missing"], extraKeys: [], potentialSecrets: [] }
  }

  const env = parseEnv(readFileSync(envPath, "utf-8"))
  const example = existsSync(examplePath) ? parseEnv(readFileSync(examplePath, "utf-8")) : {}

  const envKeys = Object.keys(env)
  const exampleKeys = Object.keys(example)

  for (const key of exampleKeys) {
    if (!envKeys.includes(key)) {
      missingKeys.push(key)
    }
  }

  for (const key of envKeys) {
    if (!exampleKeys.includes(key)) {
      extraKeys.push(key)
    }
    
    // Simple leak check: if value looks like a hardcoded secret in a file that is typically commited
    // (though .env is usually ignored, this is more for 'drift' detection)
  }

  return { missingKeys, extraKeys, potentialSecrets }
}

function parseEnv(content: string): Record<string, string> {
  const lines = content.split("\n")
  const result: Record<string, string> = {}
  for (const line of lines) {
    const parted = line.split("=")
    if (parted.length >= 2) {
      const key = parted[0].trim()
      if (key && !key.startsWith("#")) {
        result[key] = parted.slice(1).join("=").trim()
      }
    }
  }
  return result
}
