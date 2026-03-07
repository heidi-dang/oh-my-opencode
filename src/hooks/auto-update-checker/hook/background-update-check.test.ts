import type { PluginInput } from "@opencode-ai/plugin"
import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import * as checker from "../checker"
import * as versionChannel from "../version-channel"
import * as cache from "../cache"
import * as configManager from "../../../cli/config-manager"
import * as updateToasts from "./update-toasts"
import * as logger from "../../../shared/logger"

type PluginEntry = {
  entry: string
  isPinned: boolean
  pinnedVersion: string | null
  configPath: string
}

type ToastMessageGetter = (isUpdate: boolean, version?: string) => string

function createPluginEntry(overrides?: Partial<PluginEntry>): PluginEntry {
  return {
    entry: "oh-my-opencode@3.4.0",
    isPinned: false,
    pinnedVersion: null,
    configPath: "/test/opencode.json",
    ...overrides,
  }
}

const findPluginEntrySpy = spyOn(checker, "findPluginEntry").mockImplementation(() => createPluginEntry())
const getCachedVersionSpy = spyOn(checker, "getCachedVersion").mockReturnValue("3.4.0")
const getLatestVersionSpy = spyOn(checker, "getLatestVersion").mockResolvedValue("3.5.0")
const revertPinnedVersionSpy = spyOn(checker, "revertPinnedVersion").mockReturnValue(false)
const extractChannelSpy = spyOn(versionChannel, "extractChannel").mockReturnValue("latest")
const invalidatePackageSpy = spyOn(cache, "invalidatePackage").mockImplementation(() => { })
const runBunInstallSpy = spyOn(configManager, "runBunInstall").mockResolvedValue(true)
const showUpdateAvailableToastSpy = spyOn(updateToasts, "showUpdateAvailableToast").mockImplementation(async () => { })
const showAutoUpdatedToastSpy = spyOn(updateToasts, "showAutoUpdatedToast").mockImplementation(async () => { })
const logSpy = spyOn(logger, "log").mockImplementation(() => { })

const modulePath = "./background-update-check?test"
const { runBackgroundUpdateCheck } = await import(modulePath)

describe("runBackgroundUpdateCheck", () => {
  const mockCtx = { directory: "/test" } as PluginInput
  const getToastMessage: ToastMessageGetter = (isUpdate, version) =>
    isUpdate ? `Update to ${version}` : "Up to date"

  beforeEach(() => {
    findPluginEntrySpy.mockClear()
    getCachedVersionSpy.mockClear()
    getLatestVersionSpy.mockClear()
    revertPinnedVersionSpy.mockClear()
    extractChannelSpy.mockClear()
    invalidatePackageSpy.mockClear()
    runBunInstallSpy.mockClear()
    showUpdateAvailableToastSpy.mockClear()
    showAutoUpdatedToastSpy.mockClear()
    logSpy.mockClear()

    findPluginEntrySpy.mockReturnValue(createPluginEntry())
    getCachedVersionSpy.mockReturnValue("3.4.0")
    getLatestVersionSpy.mockResolvedValue("3.5.0")
    extractChannelSpy.mockReturnValue("latest")
    runBunInstallSpy.mockResolvedValue(true)
  })

  afterAll(() => {
    findPluginEntrySpy.mockRestore()
    getCachedVersionSpy.mockRestore()
    getLatestVersionSpy.mockRestore()
    revertPinnedVersionSpy.mockRestore()
    extractChannelSpy.mockRestore()
    invalidatePackageSpy.mockRestore()
    runBunInstallSpy.mockRestore()
    showUpdateAvailableToastSpy.mockRestore()
    showAutoUpdatedToastSpy.mockRestore()
    logSpy.mockRestore()
  })

  describe("#given no plugin entry found", () => {
    it("returns early without showing any toast", async () => {
      //#given
      findPluginEntrySpy.mockReturnValue(null)
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(findPluginEntrySpy).toHaveBeenCalledTimes(1)
      expect(showUpdateAvailableToastSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
      expect(runBunInstallSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given no version available", () => {
    it("returns early when neither cached nor pinned version exists", async () => {
      //#given
      findPluginEntrySpy.mockReturnValue(createPluginEntry({ entry: "oh-my-opencode" }))
      getCachedVersionSpy.mockReturnValue(null)
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(getCachedVersionSpy).toHaveBeenCalledTimes(1)
      expect(getLatestVersionSpy).not.toHaveBeenCalled()
      expect(showUpdateAvailableToastSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given latest version fetch fails", () => {
    it("returns early without toasts", async () => {
      //#given
      getLatestVersionSpy.mockResolvedValue(null)
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(getLatestVersionSpy).toHaveBeenCalledWith("latest")
      expect(runBunInstallSpy).not.toHaveBeenCalled()
      expect(showUpdateAvailableToastSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given already on latest version", () => {
    it("returns early without any action", async () => {
      //#given
      getCachedVersionSpy.mockReturnValue("3.4.0")
      getLatestVersionSpy.mockResolvedValue("3.4.0")
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(getLatestVersionSpy).toHaveBeenCalledTimes(1)
      expect(runBunInstallSpy).not.toHaveBeenCalled()
      expect(showUpdateAvailableToastSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given update available with autoUpdate disabled", () => {
    it("shows update notification but does not install", async () => {
      //#given
      const autoUpdate = false
      //#when
      await runBackgroundUpdateCheck(mockCtx, autoUpdate, getToastMessage)
      //#then
      expect(showUpdateAvailableToastSpy).toHaveBeenCalledWith(mockCtx, "3.5.0", getToastMessage)
      expect(runBunInstallSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given user has pinned a specific version", () => {
    it("shows pinned-version toast without auto-updating", async () => {
      //#given
      findPluginEntrySpy.mockReturnValue(createPluginEntry({ isPinned: true, pinnedVersion: "3.4.0" }))
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(showUpdateAvailableToastSpy).toHaveBeenCalledTimes(1)
      expect(runBunInstallSpy).not.toHaveBeenCalled()
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })

    it("toast message mentions version pinned", async () => {
      //#given
      let capturedToastMessage: ToastMessageGetter | undefined
      findPluginEntrySpy.mockReturnValue(createPluginEntry({ isPinned: true, pinnedVersion: "3.4.0" }))
      showUpdateAvailableToastSpy.mockImplementation(
        async (_ctx: PluginInput, _latestVersion: string, toastMessage: ToastMessageGetter) => {
          capturedToastMessage = toastMessage
        }
      )
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(showUpdateAvailableToastSpy).toHaveBeenCalledTimes(1)
      expect(capturedToastMessage).toBeDefined()
      if (!capturedToastMessage) {
        throw new Error("toast message callback missing")
      }
      const message = capturedToastMessage(true, "3.5.0")
      expect(message).toContain("version pinned")
      expect(message).not.toBe("Update to 3.5.0")
    })
  })

  describe("#given unpinned with auto-update and install succeeds", () => {
    it("invalidates cache, installs, and shows auto-updated toast", async () => {
      //#given
      runBunInstallSpy.mockResolvedValue(true)
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(invalidatePackageSpy).toHaveBeenCalledTimes(1)
      expect(runBunInstallSpy).toHaveBeenCalledTimes(1)
      expect(showAutoUpdatedToastSpy).toHaveBeenCalledWith(mockCtx, "3.4.0", "3.5.0")
      expect(showUpdateAvailableToastSpy).not.toHaveBeenCalled()
    })
  })

  describe("#given unpinned with auto-update and install fails", () => {
    it("falls back to notification-only toast", async () => {
      //#given
      runBunInstallSpy.mockResolvedValue(false)
      //#when
      await runBackgroundUpdateCheck(mockCtx, true, getToastMessage)
      //#then
      expect(runBunInstallSpy).toHaveBeenCalledTimes(1)
      expect(showUpdateAvailableToastSpy).toHaveBeenCalledWith(mockCtx, "3.5.0", getToastMessage)
      expect(showAutoUpdatedToastSpy).not.toHaveBeenCalled()
    })
  })
})
