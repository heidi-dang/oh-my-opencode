import color from "picocolors"
import type { DoctorResult } from "./types"
import { formatHeader, formatStatusMark } from "./format-shared"

export function formatStatus(result: DoctorResult): string {
  const lines: string[] = []

  lines.push(formatHeader())

  const { systemInfo, tools } = result
  const padding = " "

  const opencodeVer = systemInfo.opencodeVersion ?? "unknown"
  const pluginVer = systemInfo.pluginVersion ?? "unknown"
  const bunVer = systemInfo.bunVersion ?? "unknown"
  lines.push(` ${padding}System     ${opencodeVer} · ${pluginVer} · Bun ${bunVer}`)

  const configPath = systemInfo.configPath ?? "unknown"
  const configStatus = systemInfo.configValid ? color.green("(valid)") : color.red("(invalid)")
  lines.push(` ${padding}Config     ${configPath} ${configStatus}`)

  const lspText = `LSP ${tools.lspInstalled}/${tools.lspTotal}`
  const astGrepMark = formatStatusMark(tools.astGrepCli)
  const ghMark = formatStatusMark(tools.ghCli.installed && tools.ghCli.authenticated)
  const ghUser = tools.ghCli.username ?? ""
  lines.push(` ${padding}Tools      ${lspText} · AST-Grep ${astGrepMark} · gh ${ghMark}${ghUser ? ` (${ghUser})` : ""}`)

  const builtinCount = tools.mcpBuiltin.length
  const userCount = tools.mcpUser.length
  const builtinText = builtinCount > 0 ? tools.mcpBuiltin.join(" · ") : "none"
  const userText = userCount > 0 ? `+ ${userCount} user` : ""
  lines.push(` ${padding}MCPs       ${builtinText} ${userText}`)

  if (result.activeTasks && result.activeTasks.length > 0) {
    const activeTasks = result.activeTasks
    lines.push("")
    lines.push(` ${padding}Active Tasks (${activeTasks.length}):`)
    for (const task of activeTasks) {
      const { agent, description, progress } = task
      const bar = renderProgressBar(progress?.percent)
      const phase = progress?.phase ? ` [${progress.phase}]` : ""
      const message = progress?.message ? ` (${progress.message})` : ""
      lines.push(`   ${color.blue("·")} ${color.bold(agent)}: ${description}${phase}${message}`)
      lines.push(`     ${bar}`)
    }
  }

  return lines.join("\n")
}

function renderProgressBar(percent?: number): string {
  if (percent === undefined) return color.dim("[░░░░░░░░░░]") // Indeterminate
  const totalBlocks = 10
  const filledBlocks = Math.round((percent / 100) * totalBlocks)
  const emptyBlocks = totalBlocks - filledBlocks
  const bar = color.cyan("█".repeat(filledBlocks)) + color.dim("░".repeat(emptyBlocks))
  return `[${bar}] ${color.bold(percent + "%")}`
}
