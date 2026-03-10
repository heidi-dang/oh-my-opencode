import { log } from "../../shared/logger";
import { sandboxManager } from "../../features/sandbox/sandbox-manager";

export function createSandboxControlHook() {
  return {
    "chat.message": async (input: any) => {
      const text = input.message.parts?.[0]?.text?.toLowerCase() || "";
      const sessionID = (input as any).sessionID || (input.event?.properties as any)?.sessionID;

      if (!sessionID) return;

      const tui = input.client?.tui;

      if (text.includes("/sandbox on") || text.includes("@sandbox")) {
        log(`[SandboxControl] Manual enable requested for session ${sessionID}`);
        await sandboxManager.enableSandboxForSession(sessionID).then(() => {
          if (tui?.showToast) {
            tui.showToast({
              body: {
                title: "Sandbox Enabled",
                message: "Commands and file operations are now running in the Sandbox.",
                variant: "success",
                duration: 5000
              }
            }).catch(() => {});
          }
        }).catch(err => {
          log(`[SandboxControl] Failed to enable sandbox:`, err);
        });
      } else if (text.includes("/sandbox off") || text.includes("@local")) {
        log(`[SandboxControl] Manual disable requested for session ${sessionID}`);
        await sandboxManager.disableSandboxForSession(sessionID).then(() => {
          if (tui?.showToast) {
            tui.showToast({
              body: {
                title: "Sandbox Disabled",
                message: "Commands and file operations are now running locally.",
                variant: "warning",
                duration: 5000
              }
            }).catch(() => {});
          }
        }).catch(err => {
          log(`[SandboxControl] Failed to disable sandbox:`, err);
        });
      }
    },
    
    "experimental.chat.system.transform": async (
      input: { sessionID?: string },
      output: { system: string[] }
    ) => {
      if (!input.sessionID) return;
      
      if (sandboxManager.isSandboxEnabled(input.sessionID)) {
        output.system.push(
          "🟢 SANDBOX MODE ACTIVE: You are operating securely inside a containerized Sandbox. " +
          "System changes are isolated. The user can disable this by typing '/sandbox off'."
        );
      } else {
        output.system.push(
          "🔴 LOCAL MODE ACTIVE: You are operating directly on the user's local machine. " +
          "Be careful with destructive commands. The user can enable the Sandbox by typing '/sandbox on'."
        );
      }
    }
  };
}
