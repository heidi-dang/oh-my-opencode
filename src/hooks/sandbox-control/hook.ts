import { log } from "../../shared/logger";
import { sandboxManager } from "../../features/sandbox/sandbox-manager";

export function createSandboxControlHook() {
  return {
    "chat.message": async (input: any) => {
      const text = input.message.parts?.[0]?.text?.toLowerCase() || "";
      const sessionID = (input as any).sessionID || (input.event?.properties as any)?.sessionID;

      if (!sessionID) return;

      if (text.includes("/sandbox on") || text.includes("@sandbox")) {
        log(`[SandboxControl] Manual enable requested for session ${sessionID}`);
        await sandboxManager.enableSandboxForSession(sessionID).catch(err => {
          log(`[SandboxControl] Failed to enable sandbox:`, err);
        });
      } else if (text.includes("/sandbox off") || text.includes("@local")) {
        log(`[SandboxControl] Manual disable requested for session ${sessionID}`);
        await sandboxManager.disableSandboxForSession(sessionID).catch(err => {
          log(`[SandboxControl] Failed to disable sandbox:`, err);
        });
      }
    }
  };
}
