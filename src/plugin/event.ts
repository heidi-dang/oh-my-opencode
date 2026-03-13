import type { OhMyOpenCodeConfig } from "../config";
import type { PluginContext } from "./types";

import {
  clearSessionAgent,
  getMainSessionID,
  getSessionAgent,
  setMainSession,
  subagentSessions,
  syncSubagentSessions,
  updateSessionAgent,
} from "../features/claude-code-session-state";
import {
  clearPendingModelFallback,
  clearSessionFallbackChain,
  setPendingModelFallback,
} from "../hooks/model-fallback/hook";
import { resetMessageCursor } from "../shared";
import { log } from "../shared/logger";
import { SafeToastWrapper } from "../shared/safe-toast-wrapper"
import { getAgentConfigKey } from "../shared/agent-display-names"
import { memoSummarizer } from "../features/memo-summarizer";
import { knowledgeGraph } from "../shared/knowledge-graph";
import { shouldRetryError, isUnsupportedModelError } from "../shared/model-error-classifier";
import { clearSessionModel, setSessionModel } from "../shared/session-model-state";
import { deleteSessionTools } from "../shared/session-tools-store";
import { compiler } from "../runtime/plan-compiler";
import { lspManager } from "../tools";
import { sandboxManager } from "../features/sandbox/sandbox-manager";
import { createUnstableAgentBabysitter } from "./unstable-agent-babysitter"
import { resolveSessionAgent } from "./session-agent-resolver"

import type { CreatedHooks } from "../create-hooks";
import type { Managers } from "../create-managers";
import { sessionStateCache } from "../shared/session-state-cache";
import { pruneRecentSyntheticIdles } from "./recent-synthetic-idles";
import { normalizeSessionStatusToIdle } from "./session-status-normalizer";

type FirstMessageVariantGate = {
  markSessionCreated: (sessionInfo: { id?: string; title?: string; parentID?: string } | undefined) => void;
  clear: (sessionID: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFallbackModelID(modelID: string): string {
  return modelID
    .replace(/-thinking$/i, "")
    .replace(/-max$/i, "")
    .replace(/-high$/i, "");
}

function extractErrorName(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.name === "string") return error.name;
  if (error instanceof Error) return error.name;
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (isRecord(error)) {
    const candidates: unknown[] = [
      error,
      error.data,
      error.error,
      isRecord(error.data) ? error.data.error : undefined,
      error.cause,
    ];

    for (const candidate of candidates) {
      if (isRecord(candidate) && typeof candidate.message === "string" && candidate.message.length > 0) {
        return candidate.message;
      }
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractProviderModelFromErrorMessage(message: string): { providerID?: string; modelID?: string } {
  const lower = message.toLowerCase();

  const providerModel = lower.match(/model\s+not\s+found:\s*([a-z0-9_-]+)\s*\/\s*([a-z0-9._-]+)/i);
  if (providerModel) {
    return {
      providerID: providerModel[1],
      modelID: providerModel[2],
    };
  }

  const modelOnly = lower.match(/unknown\s+provider\s+for\s+model\s+([a-z0-9._-]+)/i);
  if (modelOnly) {
    return {
      modelID: modelOnly[1],
    };
  }

  return {};
}
type EventInput = Parameters<NonNullable<NonNullable<CreatedHooks["writeExistingFileGuard"]>["event"]>>[0];
export function createEventHandler(args: {
  ctx: PluginContext;
  pluginConfig: OhMyOpenCodeConfig;
  firstMessageVariantGate: FirstMessageVariantGate;
  managers: Managers;
  hooks: CreatedHooks;
}): (input: EventInput) => Promise<void> {
  const { ctx, firstMessageVariantGate, managers, hooks, pluginConfig } = args;
  const pluginContext = ctx as {
    directory: string;
    client: {
      session: {
        abort: (input: { path: { id: string } }) => Promise<unknown>;
        prompt: (input: {
          path: { id: string };
          body: { parts: Array<{ type: "text"; text: string }> };
          query: { directory: string };
        }) => Promise<unknown>;
      };
    };
  };
  const isRuntimeFallbackEnabled =
    hooks.runtimeFallback !== null &&
    hooks.runtimeFallback !== undefined &&
    (typeof args.pluginConfig.runtime_fallback === "boolean"
      ? args.pluginConfig.runtime_fallback
      : (args.pluginConfig.runtime_fallback?.enabled ?? false));

  const isModelFallbackEnabled =
    hooks.modelFallback !== null && hooks.modelFallback !== undefined;

  // Avoid triggering multiple abort+continue cycles for the same failing assistant message.
  const lastHandledModelErrorMessageID = new Map<string, string>();
  const lastHandledRetryStatusKey = new Map<string, string>();
  const lastKnownModelBySession = new Map<string, { providerID: string; modelID: string }>();

  const safeHookCall = async (hookName: string, fn: (() => unknown) | undefined): Promise<void> => {
    if (!fn) return;
    try {
      await Promise.resolve(fn());
    } catch (err) {
      log(`[event] Hook "${hookName}" threw during dispatch:`, { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const dispatchToHooks = async (input: EventInput): Promise<void> => {
    // Invalidate session cache on session events
    const sessionID = (input.event.properties as Record<string, unknown> | undefined)?.sessionID as string | undefined;
    const eventType = input.event.type;
    log("[event] dispatchToHooks start", { eventType, sessionID, timestamp: Date.now() });

    if (sessionID) {
      if (eventType === "session.created" || eventType === "session.deleted" || 
          eventType === "session.status" || eventType === "message.updated") {
        sessionStateCache.invalidate(sessionID);
      }
    }

    await safeHookCall("autoUpdateChecker", () => hooks.autoUpdateChecker?.event?.(input));
    await safeHookCall("claudeCodeHooks", () => hooks.claudeCodeHooks?.event?.(input));
    await safeHookCall("backgroundNotificationHook", () => hooks.backgroundNotificationHook?.event?.(input));
    await safeHookCall("sessionNotification", () => hooks.sessionNotification?.(input));
    await safeHookCall("todoContinuationEnforcer", () => hooks.todoContinuationEnforcer?.handler?.(input));
    await safeHookCall("unstableAgentBabysitter", () => hooks.unstableAgentBabysitter?.event?.(input));
    await safeHookCall("contextWindowMonitor", () => hooks.contextWindowMonitor?.event?.(input));
    await safeHookCall("directoryAgentsInjector", () => hooks.directoryAgentsInjector?.event?.(input));
    await safeHookCall("directoryReadmeInjector", () => hooks.directoryReadmeInjector?.event?.(input));
    await safeHookCall("rulesInjector", () => hooks.rulesInjector?.event?.(input));
    await safeHookCall("thinkMode", () => hooks.thinkMode?.event?.(input));
    await safeHookCall("anthropicContextWindowLimitRecovery", () => hooks.anthropicContextWindowLimitRecovery?.event?.(input));
    await safeHookCall("runtimeFallback", () => hooks.runtimeFallback?.event?.(input));
    await safeHookCall("agentUsageReminder", () => hooks.agentUsageReminder?.event?.(input));
    await safeHookCall("categorySkillReminder", () => hooks.categorySkillReminder?.event?.(input));
    await safeHookCall("interactiveBashSession", () => hooks.interactiveBashSession?.event?.(input as EventInput));
    await safeHookCall("ralphLoop", () => hooks.ralphLoop?.event?.(input));
    await safeHookCall("stopContinuationGuard", () => hooks.stopContinuationGuard?.event?.(input));
    await safeHookCall("compactionTodoPreserver", () => hooks.compactionTodoPreserver?.event?.(input));
    await safeHookCall("writeExistingFileGuard", () => hooks.writeExistingFileGuard?.event?.(input));
    await safeHookCall("atlasHook", () => hooks.atlasHook?.handler?.(input));
    await safeHookCall("runStateWatchdog", () => (hooks as any).runStateWatchdog?.event?.(input));

    log("[event] dispatchToHooks complete", { eventType, sessionID, timestamp: Date.now() });
  };

  const recentSyntheticIdles = new Map<string, number>();
  const recentRealIdles = new Map<string, number>();
  const DEDUP_WINDOW_MS = 500;

  const shouldAutoRetrySession = (sessionID: string): boolean => {
    if (syncSubagentSessions.has(sessionID)) return true;
    const mainSessionID = getMainSessionID();
    if (mainSessionID) return sessionID === mainSessionID;
    // Headless runs (or resumed sessions) may not emit session.created, so mainSessionID can be unset.
    // In that case, treat any non-subagent session as the "main" interactive session.
    return !subagentSessions.has(sessionID);
  };

  return async (input): Promise<void> => {
    pruneRecentSyntheticIdles({
      recentSyntheticIdles,
      recentRealIdles,
      now: Date.now(),
      dedupWindowMs: DEDUP_WINDOW_MS,
    });

    if (input.event.type === "session.idle") {
      const sessionID = (input.event.properties as Record<string, unknown> | undefined)?.sessionID as
        | string
        | undefined;
      if (sessionID) {
        const emittedAt = recentSyntheticIdles.get(sessionID);
        if (emittedAt && Date.now() - emittedAt < DEDUP_WINDOW_MS) {
          recentSyntheticIdles.delete(sessionID);
          return;
        }
        recentRealIdles.set(sessionID, Date.now());
      }
    }

    try {
      await dispatchToHooks(input);
    } catch (err) {
      log("[event] dispatchToHooks failed:", { error: err instanceof Error ? err.message : String(err) });
    }


    const syntheticIdle = normalizeSessionStatusToIdle(input);
    if (syntheticIdle) {
      const sessionID = (syntheticIdle.event.properties as Record<string, unknown>)?.sessionID as string;
      const emittedAt = recentRealIdles.get(sessionID);
      if (emittedAt && Date.now() - emittedAt < DEDUP_WINDOW_MS) {
        recentRealIdles.delete(sessionID);
        return;
      }
      recentSyntheticIdles.set(sessionID, Date.now());
      await dispatchToHooks(syntheticIdle as EventInput);
    }

    const { event } = input;
    const props = event.properties as Record<string, unknown> | undefined;

    // FIX: Trigger continuation on tool.result to prevent stall if session.idle missing
    if ((event.type as string) === "tool.result") {
      const sessionID = props?.sessionID as string | undefined;
      const toolName = props?.tool as string | undefined;
      if (sessionID) {
        log(`[event] tool.result → synthetic idle queued`, { sessionID, toolName, timestamp: Date.now() });
        // Mirror syntheticIdle logic with 100ms delay to ensure tool metadata processed
        setTimeout(async () => {
          try {
            const emittedAt = recentRealIdles.get(sessionID);
            const now = Date.now();
            if (emittedAt && now - emittedAt < DEDUP_WINDOW_MS) {
              log(`[event] Skipping synthetic idle - recent real idle exists`, { sessionID, elapsed: now - emittedAt });
              return;
            }
            recentSyntheticIdles.set(sessionID, now);
            log(`[event] Dispatching synthetic idle for tool.result`, { sessionID, toolName });
            const syntheticIdleForTool: EventInput = {
              event: {
                type: "session.idle",
                properties: { sessionID },
              },
            };
            await dispatchToHooks(syntheticIdleForTool);
          } catch (err) {
            log("[event] Error in synthetic idle setTimeout for tool.result:", { sessionID, error: err });
          }
        }, 100);
      }
    }

    if (event.type === "session.created") {
      try {
        const sessionInfo = props?.info as { id?: string; title?: string; parentID?: string } | undefined;
        const sessionID = sessionInfo?.id;

        log("[event] session.created", { sessionID, parentID: sessionInfo?.parentID, title: sessionInfo?.title });

        if (!sessionInfo?.parentID) {
          setMainSession(sessionInfo?.id);
          log("[event] Set main session", { sessionID });
        }

        firstMessageVariantGate.markSessionCreated(sessionInfo);

        await managers.tmuxSessionManager.onSessionCreated(
          event as {
            type: string;
            properties?: {
              info?: { id?: string; parentID?: string; title?: string };
            };
          },
        );
      } catch (err) {
        log("[event] Error in session.created handler:", { error: err });
      }
    }

    if (event.type === "session.deleted") {
      try {
        const sessionInfo = props?.info as { id?: string } | undefined;
        const sessionID = sessionInfo?.id;

        log("[event] session.deleted", { sessionID, mainSession: getMainSessionID() });

        if (sessionInfo?.id === getMainSessionID()) {
          setMainSession(undefined);
          log("[event] Cleared main session", { sessionID });
        }

        if (sessionInfo?.id) {
          clearSessionAgent(sessionInfo.id);
          lastHandledModelErrorMessageID.delete(sessionInfo.id);
          lastHandledRetryStatusKey.delete(sessionInfo.id);
          lastKnownModelBySession.delete(sessionInfo.id);
          clearPendingModelFallback(sessionInfo.id);
          clearSessionFallbackChain(sessionInfo.id);
          resetMessageCursor(sessionInfo.id);
          firstMessageVariantGate.clear(sessionInfo.id);
          clearSessionModel(sessionInfo.id);
          syncSubagentSessions.delete(sessionInfo.id);
          deleteSessionTools(sessionInfo.id);
          compiler.clear(sessionInfo.id);
          log("[event] Session state cleared", { sessionID });

          // Sandbox removed
          await managers.skillMcpManager.disconnectSession(sessionInfo.id);
          await lspManager.cleanupTempDirectoryClients();
          await managers.tmuxSessionManager.onSessionDeleted({
            sessionID: sessionInfo.id,
          });

          // Phase 3: Automated Memo-ing
          await memoSummarizer.summarizeSession(sessionInfo.id);
          
          // Phase 2: Knowledge Graph tracking
          knowledgeGraph.addNode({
            id: `insight:${sessionInfo.id}`,
            type: "insight",
            label: `Summary of Session ${sessionInfo.id}`,
            metadata: JSON.stringify({ source: "MemoSummarizer" })
          });
        }
      } catch (err) {
        log("[event] Error in session.deleted handler:", { error: err });
      }
    }

    if (event.type === "message.updated") {
      const info = props?.info as Record<string, unknown> | undefined;
      const sessionID = info?.sessionID as string | undefined;
      const agent = info?.agent as string | undefined;
      const role = info?.role as string | undefined;
      if (sessionID && role === "user") {
        if (agent) {
          updateSessionAgent(sessionID, agent);
        }
        const providerID = info?.providerID as string | undefined;
        const modelID = info?.modelID as string | undefined;
        if (providerID && modelID) {
          lastKnownModelBySession.set(sessionID, { providerID, modelID });
          setSessionModel(sessionID, { providerID, modelID });
        }
      }

      // Model fallback: in practice, API/model failures often surface as assistant message errors.
      // session.error events are not guaranteed for all providers, so we also observe message.updated.
      if (sessionID && role === "assistant" && !isRuntimeFallbackEnabled && isModelFallbackEnabled) {
        try {
          const assistantMessageID = info?.id as string | undefined;
          const assistantError = info?.error;
          if (assistantMessageID && assistantError) {
            const lastHandled = lastHandledModelErrorMessageID.get(sessionID);
            if (lastHandled === assistantMessageID) {
              return;
            }

            const errorName = extractErrorName(assistantError);
            const errorMessage = extractErrorMessage(assistantError);
            const errorInfo = { name: errorName, message: errorMessage };

            if (shouldRetryError(errorInfo)) {
              // Prefer the agent/model/provider from the assistant message payload.
              let agentName = agent ?? getSessionAgent(sessionID);
              if (!agentName && sessionID === getMainSessionID()) {
                if (errorMessage.includes("claude-opus") || errorMessage.includes("opus")) {
                  agentName = "sisyphus";
                } else if (errorMessage.includes("gpt-5")) {
                  agentName = "hephaestus";
                } else {
                  agentName = "sisyphus";
                }
              }

              if (agentName) {
                const currentProvider = (info?.providerID as string | undefined) ?? "opencode";
                const rawModel = (info?.modelID as string | undefined) ?? "claude-opus-4-6";
                const currentModel = normalizeFallbackModelID(rawModel);

                const setFallback = setPendingModelFallback(sessionID, agentName, currentProvider, currentModel);

                if (
                  setFallback &&
                  shouldAutoRetrySession(sessionID) &&
                  !hooks.stopContinuationGuard?.isStopped(sessionID)
                ) {
                  lastHandledModelErrorMessageID.set(sessionID, assistantMessageID);

                  await pluginContext.client?.session?.abort({ path: { id: sessionID } }).catch(() => {});
                  await pluginContext.client?.session
                    ?.prompt({
                      path: { id: sessionID },
                      body: { parts: [{ type: "text", text: "continue" }] },
                      query: { directory: pluginContext.directory },
                    })
                    .catch(() => {});
                }
              }
            }
          }
        } catch (err) {
          log("[event] model-fallback error in message.updated:", { sessionID, error: err });
        }
      }
    }

    if (event.type === "session.status") {
      const sessionID = props?.sessionID as string | undefined;
      const status = props?.status as { type?: string; attempt?: number; message?: string; next?: number } | undefined;

      if (sessionID && status?.type === "idle") {
        const backgroundManager = managers.backgroundManager;
        if (backgroundManager.hasActiveDescendants(sessionID)) {
          const count = backgroundManager.getActiveDescendantCount(sessionID);
          const descriptions = backgroundManager.getActiveDescendantDescriptions(sessionID);

          // Redirect to "waiting" status to prevent premature "completed" state
          status.type = "waiting";
          const subagentText = count === 1 ? "1 sub-agent" : `${count} sub-agents`;
          status.message = `Waiting for ${subagentText} to finish: ${descriptions.join(", ")}`;

          log("[event] Main agent waiting for sub-agents:", { sessionID, count, descriptions });
        }
      }

      if (sessionID && status?.type === "retry" && isModelFallbackEnabled) {
        try {
          const retryMessage = typeof status.message === "string" ? status.message : "";
          const retryKey = `${status.attempt ?? "?"}:${status.next ?? "?"}:${retryMessage}`;
          if (lastHandledRetryStatusKey.get(sessionID) === retryKey) {
            return;
          }
          lastHandledRetryStatusKey.set(sessionID, retryKey);

          const errorInfo = { name: undefined as string | undefined, message: retryMessage };
          if (shouldRetryError(errorInfo)) {
            let agentName = getSessionAgent(sessionID);
            if (!agentName && sessionID === getMainSessionID()) {
              if (retryMessage.includes("claude-opus") || retryMessage.includes("opus")) {
                agentName = "sisyphus";
              } else if (retryMessage.includes("gpt-5")) {
                agentName = "hephaestus";
              } else {
                agentName = "sisyphus";
              }
            }

            if (agentName) {
              const parsed = extractProviderModelFromErrorMessage(retryMessage);
              const lastKnown = lastKnownModelBySession.get(sessionID);
              const currentProvider = parsed.providerID ?? lastKnown?.providerID ?? "opencode";
              let currentModel = parsed.modelID ?? lastKnown?.modelID ?? "claude-opus-4-6";
              currentModel = normalizeFallbackModelID(currentModel);

              const setFallback = setPendingModelFallback(sessionID, agentName, currentProvider, currentModel);

              if (
                setFallback &&
                shouldAutoRetrySession(sessionID) &&
                !hooks.stopContinuationGuard?.isStopped(sessionID)
              ) {
                await pluginContext.client?.session?.abort({ path: { id: sessionID } }).catch(() => {});
                await pluginContext.client?.session
                  ?.prompt({
                    path: { id: sessionID },
                    body: { parts: [{ type: "text", text: "continue" }] },
                    query: { directory: pluginContext.directory },
                  })
                  .catch(() => {});
              }
            }
          }
        } catch (err) {
          log("[event] model-fallback error in session.status:", { sessionID, error: err });
        }
      }
    }

    if (event.type === "session.error") {
      try {
        const sessionID = props?.sessionID as string | undefined;
        const error = props?.error;

        const errorName = extractErrorName(error);
        const errorMessage = extractErrorMessage(error);
        const errorInfo = { name: errorName, message: errorMessage };

        // Detect unsupported model errors (e.g. GitHub Copilot model_not_supported)
        // These need special handling: richer message and deterministic fallback or block.
        // We handle this BEFORE generic retry logic to avoid redundant transport-level retries.
        const unsupportedModel = isUnsupportedModelError(error)

        if (unsupportedModel && sessionID) {
          const lastKnown = lastKnownModelBySession.get(sessionID)
          const modelLabel = lastKnown
            ? `${lastKnown.providerID}/${lastKnown.modelID}`
            : "the selected model"

          // 1. If fallback is enabled and we have a chain, switch models immediately
          if (isModelFallbackEnabled) {
            let agentName = getSessionAgent(sessionID)
            if (!agentName && sessionID === getMainSessionID()) {
              // Heuristic if agent name not in cache
              agentName = errorMessage.toLowerCase().includes("gpt-5") ? "hephaestus" : "sisyphus"
            }

            if (agentName) {
              const currentProvider = (props?.providerID as string) || lastKnown?.providerID || "opencode";
              let currentModel = (props?.modelID as string) || lastKnown?.modelID || "claude-opus-4-6";
              currentModel = normalizeFallbackModelID(currentModel);

              const setFallback = setPendingModelFallback(sessionID, agentName, currentProvider, currentModel);
              if (setFallback) {
                 log("[event] Unsupported model detected, fallback mode armed for session:", { sessionID, modelLabel })
                 // Switch model and prompt 'continue' to resume with new provider/model
                  await pluginContext.client?.session?.prompt({
                    path: { id: sessionID },
                    body: { parts: [{ type: "text", text: "continue" }] },
                    query: { directory: pluginContext.directory }
                  }).catch(() => {})
                 return
              }
            }
          }

          // 2. If no fallback or fallback exhausted, surface a terminal "blocked" state
          log("[event] Unsupported model with no fallback, session blocked:", { sessionID, modelLabel })
          SafeToastWrapper.showError(
            pluginContext as any,
            "Model not supported",
            `${modelLabel} is not supported by this provider. Please select a different model.`,
            `event:unsupported-model:${sessionID}`
          )

          // Abort the stuck session so OpenCode shows a terminal error state
          await pluginContext.client?.session?.abort({ path: { id: sessionID } }).catch(() => {})
          return
        }

        // First, try session recovery for internal errors (thinking blocks, tool results, etc.)
        if (hooks.sessionRecovery?.isRecoverableError(error)) {
          const messageInfo = {
            id: props?.messageID as string | undefined,
            role: "assistant" as const,
            sessionID,
            error,
          };
          const recovered = await hooks.sessionRecovery.handleSessionRecovery(messageInfo);

          if (
            recovered &&
            sessionID &&
            sessionID === getMainSessionID() &&
            !hooks.stopContinuationGuard?.isStopped(sessionID)
          ) {
            await pluginContext.client?.session
              ?.prompt({
                path: { id: sessionID },
                body: { parts: [{ type: "text", text: "continue" }] },
                query: { directory: pluginContext.directory },
              })
              .catch(() => {});
          }
        }
        // Second, try model fallback for model errors (rate limit, quota, provider issues, etc.)
        else if (sessionID && shouldRetryError(errorInfo) && !isRuntimeFallbackEnabled && isModelFallbackEnabled) {
          let agentName = getSessionAgent(sessionID);

          if (!agentName && sessionID === getMainSessionID()) {
            if (errorMessage.includes("claude-opus") || errorMessage.includes("opus")) {
              agentName = "sisyphus";
            } else if (errorMessage.includes("gpt-5")) {
              agentName = "hephaestus";
            } else {
              agentName = "sisyphus";
            }
          }

          if (agentName) {
            const parsed = extractProviderModelFromErrorMessage(errorMessage);
            const currentProvider = (props?.providerID as string) || parsed.providerID || "opencode";
            let currentModel = (props?.modelID as string) || parsed.modelID || "claude-opus-4-6";
            currentModel = normalizeFallbackModelID(currentModel);

            const setFallback = setPendingModelFallback(sessionID, agentName, currentProvider, currentModel);

            if (
              setFallback &&
              shouldAutoRetrySession(sessionID) &&
              !hooks.stopContinuationGuard?.isStopped(sessionID)
            ) {
              await pluginContext.client?.session?.abort({ path: { id: sessionID } }).catch(() => {});

              await pluginContext.client?.session
                ?.prompt({
                  path: { id: sessionID },
                  body: { parts: [{ type: "text", text: "continue" }] },
                  query: { directory: pluginContext.directory },
                })
                .catch(() => {});
            }
          }
        }
      } catch (err) {
        const sessionID = props?.sessionID as string | undefined;
        log("[event] model-fallback error in session.error:", { sessionID, error: err });
      }
    }
  };
}
