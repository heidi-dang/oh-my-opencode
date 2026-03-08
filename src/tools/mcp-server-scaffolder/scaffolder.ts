import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { STDIO_TEMPLATE, PACKAGE_JSON_TEMPLATE } from "./templates"

export async function scaffoldMcpServer(name: string, directory: string): Promise<string> {
  const serverDir = join(directory, "mcp-servers", name)
  
  if (existsSync(serverDir)) {
    throw new Error(`Directory already exists: ${serverDir}`)
  }

  mkdirSync(serverDir, { recursive: true })
  
  writeFileSync(join(serverDir, "index.js"), STDIO_TEMPLATE)
  writeFileSync(join(serverDir, "package.json"), PACKAGE_JSON_TEMPLATE(name))

  return `Successfully scaffolded MCP server '${name}' at ${serverDir}\n\nTo start:\n1. cd ${serverDir}\n2. npm install\n3. npm start`
}
