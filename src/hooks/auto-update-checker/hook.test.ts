import { afterEach, beforeEach, describe, expect, it, spyOn, afterAll } from "bun:test"
import * as configErrorsToast from "./hook/config-errors-toast"
import * as modelCacheWarning from "./hook/model-cache-warning"
import * as connectedProvidersStatus from "./hook/connected-providers-status"
import * as startupToasts from "./hook/startup-toasts"
import * as backgroundUpdateCheck from "./hook/background-update-check"
import * as checker from "./checker"
import * as logger from "../../shared/logger"
import { createAutoUpdateCheckerHook } from "./hook"

const showConfigErrorsIfAnySpy = spyOn(configErrorsToast, "showConfigErrorsIfAny").mockImplementation(async () => { })
const showModelCacheWarningIfNeededSpy = spyOn(modelCacheWarning, "showModelCacheWarningIfNeeded").mockImplementation(async () => { })
const updateAndShowConnectedProvidersCacheStatusSpy = spyOn(connectedProvidersStatus, "updateAndShowConnectedProvidersCacheStatus").mockImplementation(async () => { })
const showLocalDevToastSpy = spyOn(startupToasts, "showLocalDevToast").mockImplementation(async () => { })
const showVersionToastSpy = spyOn(startupToasts, "showVersionToast").mockImplementation(async () => { })
const runBackgroundUpdateCheckSpy = spyOn(backgroundUpdateCheck, "runBackgroundUpdateCheck").mockImplementation(async () => { })
const getCachedVersionSpy = spyOn(checker, "getCachedVersion").mockReturnValue("3.6.0")
const getLocalDevVersionSpy = spyOn(checker, "getLocalDevVersion").mockReturnValue(null)
const logSpy = spyOn(logger, "log").mockImplementation(() => { })

function createPluginInput() {
  return {
    directory: "/test",
    client: {} as never,
  } as never
}

beforeEach(() => {
  showConfigErrorsIfAnySpy.mockClear()
  showModelCacheWarningIfNeededSpy.mockClear()
  updateAndShowConnectedProvidersCacheStatusSpy.mockClear()
  showLocalDevToastSpy.mockClear()
  showVersionToastSpy.mockClear()
  runBackgroundUpdateCheckSpy.mockClear()
  getCachedVersionSpy.mockClear()
  getLocalDevVersionSpy.mockClear()
  logSpy.mockClear()

  getCachedVersionSpy.mockReturnValue("3.6.0")
  getLocalDevVersionSpy.mockReturnValue(null)
})

afterAll(() => {
  showConfigErrorsIfAnySpy.mockRestore()
  showModelCacheWarningIfNeededSpy.mockRestore()
  updateAndShowConnectedProvidersCacheStatusSpy.mockRestore()
  showLocalDevToastSpy.mockRestore()
  showVersionToastSpy.mockRestore()
  runBackgroundUpdateCheckSpy.mockRestore()
  getCachedVersionSpy.mockRestore()
  getLocalDevVersionSpy.mockRestore()
  logSpy.mockRestore()
})

afterEach(() => {
  delete process.env.OPENCODE_CLI_RUN_MODE
})

describe("createAutoUpdateCheckerHook", () => {
  it("skips startup toasts and checks in CLI run mode", async () => {
    //#given - CLI run mode enabled
    process.env.OPENCODE_CLI_RUN_MODE = "true"

    const hook = createAutoUpdateCheckerHook(createPluginInput(), {
      showStartupToast: true,
      isSisyphusEnabled: true,
      autoUpdate: true,
    })

    //#when - session.created event arrives
    hook.event({
      event: {
        type: "session.created",
        properties: { info: { parentID: undefined } },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - no update checker side effects run
    expect(showConfigErrorsIfAnySpy).not.toHaveBeenCalled()
    expect(showModelCacheWarningIfNeededSpy).not.toHaveBeenCalled()
    expect(updateAndShowConnectedProvidersCacheStatusSpy).not.toHaveBeenCalled()
    expect(showLocalDevToastSpy).not.toHaveBeenCalled()
    expect(showVersionToastSpy).not.toHaveBeenCalled()
    expect(runBackgroundUpdateCheckSpy).not.toHaveBeenCalled()
  })

  it("runs all startup checks on normal session.created", async () => {
    //#given - normal mode and no local dev version
    const hook = createAutoUpdateCheckerHook(createPluginInput())

    //#when - session.created event arrives on primary session
    hook.event({
      event: {
        type: "session.created",
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - startup checks, toast, and background check run
    expect(showConfigErrorsIfAnySpy).toHaveBeenCalledTimes(1)
    expect(updateAndShowConnectedProvidersCacheStatusSpy).toHaveBeenCalledTimes(1)
    expect(showModelCacheWarningIfNeededSpy).toHaveBeenCalledTimes(1)
    expect(showVersionToastSpy).toHaveBeenCalledTimes(1)
    expect(runBackgroundUpdateCheckSpy).toHaveBeenCalledTimes(1)
  })

  it("ignores subagent sessions (parentID present)", async () => {
    //#given - a subagent session with parentID
    const hook = createAutoUpdateCheckerHook(createPluginInput())

    //#when - session.created event contains parentID
    hook.event({
      event: {
        type: "session.created",
        properties: { info: { parentID: "parent-123" } },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - no startup actions run
    expect(showConfigErrorsIfAnySpy).not.toHaveBeenCalled()
    expect(updateAndShowConnectedProvidersCacheStatusSpy).not.toHaveBeenCalled()
    expect(showModelCacheWarningIfNeededSpy).not.toHaveBeenCalled()
    expect(showLocalDevToastSpy).not.toHaveBeenCalled()
    expect(showVersionToastSpy).not.toHaveBeenCalled()
    expect(runBackgroundUpdateCheckSpy).not.toHaveBeenCalled()
  })

  it("runs only once (hasChecked guard)", async () => {
    //#given - one hook instance in normal mode
    const hook = createAutoUpdateCheckerHook(createPluginInput())

    //#when - session.created event is fired twice
    hook.event({
      event: {
        type: "session.created",
      },
    })
    hook.event({
      event: {
        type: "session.created",
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - side effects execute only once
    expect(showConfigErrorsIfAnySpy).toHaveBeenCalledTimes(1)
    expect(updateAndShowConnectedProvidersCacheStatusSpy).toHaveBeenCalledTimes(1)
    expect(showModelCacheWarningIfNeededSpy).toHaveBeenCalledTimes(1)
    expect(showVersionToastSpy).toHaveBeenCalledTimes(1)
    expect(runBackgroundUpdateCheckSpy).toHaveBeenCalledTimes(1)
  })

  it("shows localDevToast when local dev version exists", async () => {
    //#given - local dev version is present
    getLocalDevVersionSpy.mockReturnValue("3.6.0-dev")
    const hook = createAutoUpdateCheckerHook(createPluginInput())

    //#when - session.created event arrives
    hook.event({
      event: {
        type: "session.created",
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - local dev toast is shown and background check is skipped
    expect(showConfigErrorsIfAnySpy).toHaveBeenCalledTimes(1)
    expect(updateAndShowConnectedProvidersCacheStatusSpy).toHaveBeenCalledTimes(1)
    expect(showModelCacheWarningIfNeededSpy).toHaveBeenCalledTimes(1)
    expect(showLocalDevToastSpy).toHaveBeenCalledTimes(1)
    expect(showVersionToastSpy).not.toHaveBeenCalled()
    expect(runBackgroundUpdateCheckSpy).not.toHaveBeenCalled()
  })

  it("ignores non-session.created events", async () => {
    //#given - a hook instance in normal mode
    const hook = createAutoUpdateCheckerHook(createPluginInput())

    //#when - a non-session.created event arrives
    hook.event({
      event: {
        type: "session.deleted",
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - no startup actions run
    expect(showConfigErrorsIfAnySpy).not.toHaveBeenCalled()
    expect(updateAndShowConnectedProvidersCacheStatusSpy).not.toHaveBeenCalled()
    expect(showModelCacheWarningIfNeededSpy).not.toHaveBeenCalled()
    expect(showLocalDevToastSpy).not.toHaveBeenCalled()
    expect(showVersionToastSpy).not.toHaveBeenCalled()
    expect(runBackgroundUpdateCheckSpy).not.toHaveBeenCalled()
  })

  it("passes correct toast message with sisyphus enabled", async () => {
    //#given - sisyphus mode enabled
    const hook = createAutoUpdateCheckerHook(createPluginInput(), {
      isSisyphusEnabled: true,
    })

    //#when - session.created event arrives
    hook.event({
      event: {
        type: "session.created",
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    //#then - startup toast includes sisyphus wording
    expect(showVersionToastSpy).toHaveBeenCalledTimes(1)
    expect(showVersionToastSpy).toHaveBeenCalledWith(
      expect.anything(),
      "3.6.0",
      expect.stringContaining("Sisyphus")
    )
  })
})
