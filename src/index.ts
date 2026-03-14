import { initConfigContext } from "./cli/config-manager/config-context";
import type { Plugin } from "@opencode-ai/plugin";

import type { HookName } from "./config";

import { createHooks } from "./create-hooks";
import { createManagers } from "./create-managers";
import { createTools } from "./create-tools";
import { createPluginInterface } from "./plugin-interface";

import { loadPluginConfig } from "./plugin-config";
import { createModelCacheState } from "./plugin-state";
import { initializePerformanceOptimizations } from "./shared/performance-integration";
import { createFirstMessageVariantGate } from "./shared/first-message-variant";
import {
  injectServerAuthIntoClient,
  log,
  injectYGKAInterceptor,
} from "./shared";
import { startTmuxCheck } from "./tools";
import { runtimeInterceptor } from "./features/diagnostic-intelligence/runtime-interceptor";
import { memoryWatchdog } from "./features/diagnostic-intelligence/memory-watchdog";
import { networkInterceptor } from "./features/diagnostic-intelligence/network-interceptor";
import { performanceMonitor } from "./features/diagnostic-intelligence/performance-monitor";
import { uiUxMonitor } from "./features/diagnostic-intelligence/ui-ux-monitor";
import { buildBatchRepairInstructions } from "./features/diagnostic-intelligence/repair-instructions-builder";
import { getMainSessionID } from "./features/claude-code-session-state";
import { SafeDiagnosticTriggerWrapper } from "./shared/safe-diagnostic-wrapper";

/**
 * Detect and decode base64-encoded directory paths.
 *
 * The OpenCode server sometimes encodes the workspace directory as base64
 * before passing it to plugins. A valid Unix directory starts with "/" and
 * a valid Windows directory starts with a drive letter (e.g. "C:\").
 * If neither is true and the string is valid base64 that decodes to an
 * absolute path, we use the decoded version.
 */
function resolveDirectory(raw: string): string {
  if (!raw) return raw;

  const looksAbsolute = raw.startsWith("/") || /^[A-Za-z]:[/\\]/.test(raw);
  if (looksAbsolute) return raw;

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded.startsWith("/") || /^[A-Za-z]:[/\\]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // Not valid base64 — keep as-is
  }

  return raw;
}

const OhMyOpenCodePlugin: Plugin = async (ctx) => {
  // Initialize config context for plugin runtime (prevents warnings from hooks)
  initConfigContext("opencode", null);

  // Decode base64-encoded directory if the server passed one
  const resolvedDir = resolveDirectory(ctx.directory);
  if (resolvedDir !== ctx.directory) {
    log("[OhMyOpenCodePlugin] Decoded base64 directory", {
      raw: ctx.directory,
      decoded: resolvedDir,
    });
    (ctx as any).directory = resolvedDir;
  }

  log("[OhMyOpenCodePlugin] ENTRY - plugin loading", {
    directory: ctx.directory,
  });

  injectServerAuthIntoClient(ctx.client);
  injectYGKAInterceptor(ctx.client);
  startTmuxCheck();

  // --- DIAGNOSTIC DEDUPLICATION ---
  const handledDiagnostics = new Set<string>();
  const isDuplicate = (diagnostic: any) => {
    const key = `${diagnostic.class}:${diagnostic.symbol}`;
    if (handledDiagnostics.has(key)) return true;
    handledDiagnostics.add(key);
    // Auto-clear from deduplication after 5 minutes to allow re-detection of recurring issues
    setTimeout(() => handledDiagnostics.delete(key), 300000);
    return false;
  };

  // --- GLOBAL ERROR PROTECTION & AUTONOMOUS REPAIR ---
  runtimeInterceptor.subscribe(async (diagnostic) => {
    if (isDuplicate(diagnostic)) return;
    const mainSessionID = getMainSessionID();
    if (!mainSessionID) return;

    try {
      const instructions = buildBatchRepairInstructions([diagnostic]);
      const payload = `[RUNTIME CRASH DETECTED]\nThe Node process encountered a fatal exception. DO NOT ignore this. You must fix the root cause.\n\n${instructions}`;

      log("[OhMyOpenCodePlugin] Intercepted crash, notifying agent", {
        sessionID: mainSessionID,
        diagnosticClass: diagnostic.class,
      });

      SafeDiagnosticTriggerWrapper.triggerDiagnostic(
        ctx,
        diagnostic.class,
        "Runtime Crash: Fatal exception",
      );
      await ctx.client.session
        .prompt({
          path: { id: mainSessionID },
          body: { parts: [{ type: "text", text: payload }] },
          query: { directory: ctx.directory },
        })
        .catch((e) =>
          log("[OhMyOpenCodePlugin] Failed to prompt agent with crash", e),
        );
      SafeDiagnosticTriggerWrapper.triggerDiagnostic(ctx, null);
    } catch (err) {
      log("[OhMyOpenCodePlugin] Error in crash subscriber", err);
    }
  });

  memoryWatchdog.subscribe(async (diagnostic) => {
    if (isDuplicate(diagnostic)) return;
    const mainSessionID = getMainSessionID();
    if (!mainSessionID) return;

    try {
      const instructions = buildBatchRepairInstructions([diagnostic]);
      const payload = `[MEMORY ANOMALY DETECTED]\nActive memory monitoring has flagged a leak or extreme utilization. You must investigate and repair this immediately.\n\n${instructions}`;

      log("[OhMyOpenCodePlugin] Memory anomaly, notifying agent", {
        sessionID: mainSessionID,
        diagnosticClass: diagnostic.class,
      });

      SafeDiagnosticTriggerWrapper.triggerDiagnostic(
        ctx,
        diagnostic.class,
        "Memory Exhaustion Detected",
      );
      await ctx.client.session
        .prompt({
          path: { id: mainSessionID },
          body: { parts: [{ type: "text", text: payload }] },
          query: { directory: ctx.directory },
        })
        .catch((e) =>
          log(
            "[OhMyOpenCodePlugin] Failed to prompt agent with memory leak",
            e,
          ),
        );
      SafeDiagnosticTriggerWrapper.triggerDiagnostic(ctx, null);
    } catch (err) {
      log("[OhMyOpenCodePlugin] Error in memory watchdog subscriber", err);
    }
  });

  networkInterceptor.subscribe(async (diagnostic) => {
    if (isDuplicate(diagnostic)) return;
    const mainSessionID = getMainSessionID();
    if (!mainSessionID) return;

    try {
      const instructions = buildBatchRepairInstructions([diagnostic]);
      const payload = `[NETWORK FAILURE DETECTED]\nA network operation failed. Review the diagnostic and implement the recommended repair strategy.\n\n${instructions}`;

      log("[OhMyOpenCodePlugin] Network failure, notifying agent", {
        sessionID: mainSessionID,
        diagnosticClass: diagnostic.class,
      });

      SafeDiagnosticTriggerWrapper.triggerDiagnostic(
        ctx,
        diagnostic.class,
        "Network Failure/Drop Detected",
      );
      await ctx.client.session
        .prompt({
          path: { id: mainSessionID },
          body: { parts: [{ type: "text", text: payload }] },
          query: { directory: ctx.directory },
        })
        .catch((e) =>
          log(
            "[OhMyOpenCodePlugin] Failed to prompt agent with network failure",
            e,
          ),
        );
      SafeDiagnosticTriggerWrapper.triggerDiagnostic(ctx, null);
    } catch (err) {
      log("[OhMyOpenCodePlugin] Error in network subscriber", err);
    }
  });

  performanceMonitor.subscribe(async (diagnostic) => {
    if (isDuplicate(diagnostic)) return;
    const mainSessionID = getMainSessionID();
    if (!mainSessionID) return;

    try {
      const instructions = buildBatchRepairInstructions([diagnostic]);
      const payload = `[PERFORMANCE DEGRADATION DETECTED]\nA performance bottleneck has been identified. Investigate and optimize the flagged operation.\n\n${instructions}`;

      log("[OhMyOpenCodePlugin] Performance issue, notifying agent", {
        sessionID: mainSessionID,
        diagnosticClass: diagnostic.class,
      });

      SafeDiagnosticTriggerWrapper.triggerDiagnostic(
        ctx,
        diagnostic.class,
        "Performance Degradation Detected",
      );
      await ctx.client.session
        .prompt({
          path: { id: mainSessionID },
          body: { parts: [{ type: "text", text: payload }] },
          query: { directory: ctx.directory },
        })
        .catch((e) =>
          log("[OhMyOpenCodePlugin] Failed to prompt agent with perf issue", e),
        );
      SafeDiagnosticTriggerWrapper.triggerDiagnostic(ctx, null);
    } catch (err) {
      log("[OhMyOpenCodePlugin] Error in performance subscriber", err);
    }
  });

  uiUxMonitor.subscribe(async (diagnostic) => {
    if (isDuplicate(diagnostic)) return;
    const mainSessionID = getMainSessionID();
    if (!mainSessionID) return;

    try {
      const instructions = buildBatchRepairInstructions([diagnostic]);
      const payload = `[UI/UX FUNCTIONAL BUG DETECTED]\nA visual or interaction regression occurred in the UI. Read the diagnostic carefully and implement the CSS/React fix.\n\n${instructions}`;

      log("[OhMyOpenCodePlugin] UI/UX bug intercepted, notifying agent", {
        sessionID: mainSessionID,
        diagnosticClass: diagnostic.class,
      });

      SafeDiagnosticTriggerWrapper.triggerDiagnostic(
        ctx,
        diagnostic.class,
        "Visual/Interaction Bug Detected",
      );
      await ctx.client.session
        .prompt({
          path: { id: mainSessionID },
          body: { parts: [{ type: "text", text: payload }] },
          query: { directory: ctx.directory },
        })
        .catch((e) =>
          log("[OhMyOpenCodePlugin] Failed to prompt agent with UI/UX bug", e),
        );
      SafeDiagnosticTriggerWrapper.triggerDiagnostic(ctx, null);
    } catch (err) {
      log("[OhMyOpenCodePlugin] Error in UI/UX subscriber", err);
    }
  });
  // -------------------------------

  const pluginConfig = await loadPluginConfig(ctx.directory, ctx);
  initializePerformanceOptimizations(pluginConfig, ctx);
  const disabledHooks = new Set(pluginConfig.disabled_hooks ?? []);

  const isHookEnabled = (hookName: HookName): boolean =>
    !disabledHooks.has(hookName);
  const safeHookEnabled = pluginConfig.experimental?.safe_hook_creation ?? true;

  const firstMessageVariantGate = createFirstMessageVariantGate();

  const tmuxConfig = {
    enabled: pluginConfig.tmux?.enabled ?? false,
    layout: pluginConfig.tmux?.layout ?? "main-vertical",
    main_pane_size: pluginConfig.tmux?.main_pane_size ?? 60,
    main_pane_min_width: pluginConfig.tmux?.main_pane_min_width ?? 120,
    agent_pane_min_width: pluginConfig.tmux?.agent_pane_min_width ?? 40,
  };

  const modelCacheState = createModelCacheState();

  const managers = createManagers({
    ctx,
    pluginConfig,
    tmuxConfig,
    modelCacheState,
    backgroundNotificationHookEnabled: isHookEnabled("background-notification"),
  });

  const toolsResult = await createTools({
    ctx,
    pluginConfig,
    managers,
  });
  const hooks = createHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    backgroundManager: managers.backgroundManager,
    runStateWatchdogManager: managers.runStateWatchdogManager,
    isHookEnabled,
    safeHookEnabled,
    firstMessageVariantGate,
    mergedSkills: toolsResult.mergedSkills,
    availableSkills: toolsResult.availableSkills,
  });

  const pluginInterface = createPluginInterface({
    ctx,
    pluginConfig,
    firstMessageVariantGate,
    managers,
    hooks,
    tools: toolsResult.filteredTools,
  });

  // Cleanup on shutdown — full signal coverage for 10/10 stability
  const gracefulShutdown = (signal: string) => {
    log(`[OhMyOpenCodePlugin] ${signal} received. Shutting down managers.`);
    managers.runStateWatchdogManager.stop();
  };

  process.on("uncaughtException", (error) => {
    log(`[OhMyOpenCodePlugin] Uncaught exception:`, error);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    log(`[OhMyOpenCodePlugin] Unhandled rejection:`, reason);
    gracefulShutdown("unhandledRejection");
  });

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));
  process.on("exit", () => gracefulShutdown("exit"));

  return {
    ...pluginInterface,

    "experimental.session.compacting": async (
      _input: { sessionID: string },
      output: { context: string[] },
    ): Promise<void> => {
      await hooks.compactionTodoPreserver?.capture(_input.sessionID);
      await hooks.claudeCodeHooks?.["experimental.session.compacting"]?.(
        _input,
        output,
      );
      if (hooks.compactionContextInjector) {
        output.context.push(hooks.compactionContextInjector(_input.sessionID));
      }
    },
  };
};

export default OhMyOpenCodePlugin;

export type {
  OhMyOpenCodeConfig,
  AgentName,
  AgentOverrideConfig,
  AgentOverrides,
  McpName,
  HookName,
  BuiltinCommandName,
} from "./config";

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Config error utilities are available via "./shared/config-errors" for internal use only.
export type { ConfigLoadError } from "./shared/config-errors";
