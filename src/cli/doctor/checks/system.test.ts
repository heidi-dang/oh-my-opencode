import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import * as binary from "./system-binary"
import * as plugin from "./system-plugin"
import * as loaded from "./system-loaded-version"

const { checkSystem } = await import("./system?test")

describe("system check", () => {
  beforeEach(() => {
    spyOn(binary, "findOpenCodeBinary").mockResolvedValue({ path: "/usr/local/bin/opencode" })
    spyOn(binary, "getOpenCodeVersion").mockResolvedValue("1.0.200")
    spyOn(binary, "compareVersions").mockImplementation((v1, v2) => {
      // Simple mock implementation or just mockReturnValue(true)
      return true
    })
    spyOn(plugin, "getPluginInfo").mockReturnValue({
      registered: true,
      entry: "oh-my-opencode",
      isPinned: false,
      pinnedVersion: null,
      configPath: null,
      isLocalDev: false,
    })
    spyOn(loaded, "getLoadedPluginVersion").mockReturnValue({
      cacheDir: "/Users/test/Library/Caches/opencode with spaces",
      cachePackagePath: "/tmp/package.json",
      installedPackagePath: "/tmp/node_modules/oh-my-opencode/package.json",
      expectedVersion: "3.0.0",
      loadedVersion: "3.1.0",
    })
    spyOn(loaded, "getLatestPluginVersion").mockResolvedValue(null)
  })

  describe("#given cache directory contains spaces", () => {
    it("uses a quoted cache directory in mismatch fix command", async () => {
      //#when
      const { checkSystem } = await import("./system?test-quoted")
      const result = await checkSystem()

      //#then
      const mismatchIssue = result.issues.find((issue) => issue.title === "Loaded plugin version mismatch")
      expect(mismatchIssue?.fix).toBe('Reinstall: cd "/Users/test/Library/Caches/opencode with spaces" && bun install')
    })

    it("uses the loaded version channel for update fix command", async () => {
      //#given
      spyOn(loaded, "getLoadedPluginVersion").mockReturnValue({
        cacheDir: "/Users/test/Library/Caches/opencode with spaces",
        cachePackagePath: "/tmp/package.json",
        installedPackagePath: "/tmp/node_modules/oh-my-opencode/package.json",
        expectedVersion: "3.0.0-canary.1",
        loadedVersion: "3.0.0-canary.1",
      })
      spyOn(loaded, "getLatestPluginVersion").mockResolvedValue("3.0.0-canary.2")
      spyOn(binary, "compareVersions").mockImplementation((leftVersion: string, rightVersion: string) => {
        return !(leftVersion === "3.0.0-canary.1" && rightVersion === "3.0.0-canary.2")
      })

      //#when
      const { checkSystem } = await import("./system?test-update")
      const result = await checkSystem()

      //#then
      const outdatedIssue = result.issues.find((issue) => issue.title === "Loaded plugin is outdated")
      expect(outdatedIssue?.fix).toBe(
        'Update: cd "/Users/test/Library/Caches/opencode with spaces" && bun add oh-my-opencode@canary'
      )
    })
  })
})
