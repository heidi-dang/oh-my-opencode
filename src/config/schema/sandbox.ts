import { z } from "zod"

export const SandboxProviderTypeSchema = z.enum(["local", "daytona"])

export const SandboxConfigSchema = z.object({
  /** Enable sandboxed execution (default: false) */
  enabled: z.boolean().optional(),
  /** The sandbox provider to use (default: "daytona" if API key is present) */
  provider: SandboxProviderTypeSchema.optional(),
  /** Daytona API Key (env: DAYTONA_API_KEY) */
  daytona_api_key: z.string().optional(),
  /** Daytona Server URL (optional) */
  daytona_server_url: z.string().optional(),
  /** Default project path inside the sandbox (default: "/home/daytona/project") */
  repo_path: z.string().default("/home/daytona/project").optional(),
  /** Control how sessions are assigned to sandboxes (default: "auto") */
  session_control: z.enum(["auto", "manual", "never"]).default("auto").optional(),
})

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>
