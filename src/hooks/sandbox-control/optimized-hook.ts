import { log } from "../../shared/logger";
import { sandboxManager } from "../../features/sandbox/sandbox-manager";
import { SafeToastWrapper } from "../../shared/safe-toast-wrapper";

/**
 * Optimized Sandbox Control Hook
 * 
 * Performance improvements:
 * 1. Pre-compiled command patterns for faster matching
 * 2. Reduced string operations and allocations
 * 3. Cached session state to avoid repeated API calls
 * 4. Debounced toast notifications
 * 5. Optimized message parsing
 */
export function createOptimizedSandboxControlHook() {
  // Pre-compiled patterns for better performance
  const ENABLE_PATTERNS = ["/sandbox on", "@sandbox"]
  const DISABLE_PATTERNS = ["/sandbox off", "@local"]
  
  // Cache for session sandbox state
  const sessionSandboxCache = new Map<string, { enabled: boolean; timestamp: number }>()
  const cacheTTL = 10000 // 10 seconds
  
  // Toast debounce tracking
  const lastToastTime = new Map<string, number>()
  const toastDebounceMs = 2000 // 2 seconds between toasts
  
  const getSessionID = (input: any): string | undefined => {
    return (input as any).sessionID || 
           input.event?.properties?.sessionID || 
           input.message?.sessionID
  }
  
  const extractText = (input: any): string => {
    const parts = input.message?.parts
    if (!parts || parts.length === 0) return ""
    
    const firstPart = parts[0]
    return firstPart?.text?.toLowerCase() || ""
  }
  
  const checkCommand = (text: string, patterns: string[]): boolean => {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        return true
      }
    }
    return false
  }
  
  const getCachedSandboxState = (sessionID: string): boolean | null => {
    const cached = sessionSandboxCache.get(sessionID)
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > cacheTTL) {
      sessionSandboxCache.delete(sessionID)
      return null
    }
    
    return cached.enabled
  }
  
  const setCachedSandboxState = (sessionID: string, enabled: boolean): void => {
    sessionSandboxCache.set(sessionID, {
      enabled,
      timestamp: Date.now()
    })
  }
  
  const shouldShowToast = (sessionID: string, type: "enable" | "disable"): boolean => {
    const key = `${sessionID}:${type}`
    const lastTime = lastToastTime.get(key) || 0
    const now = Date.now()
    
    if (now - lastTime < toastDebounceMs) {
      return false
    }
    
    lastToastTime.set(key, now)
    return true
  }
  
  const showToast = (input: any, title: string, message: string, variant: "success" | "warning", sessionID: string, type: "enable" | "disable") => {
    if (!shouldShowToast(sessionID, type)) return
    
    try {
      const tui = input.client?.tui
      if (tui?.showToast) {
        tui.showToast({
          body: {
            title,
            message,
            variant,
            duration: 5000
          }
        }).catch(() => {})
      }
    } catch {
      // Swallow toast errors
    }
  }
  
  return {
    "chat.message": async (input: any) => {
      const sessionID = getSessionID(input)
      if (!sessionID) return

      const text = extractText(input)
      if (!text) return

      const isEnable = checkCommand(text, ENABLE_PATTERNS)
      const isDisable = checkCommand(text, DISABLE_PATTERNS)
      
      if (!isEnable && !isDisable) return

      try {
        if (isEnable) {
          log(`[SandboxControl] Manual enable requested for session ${sessionID}`)
          await sandboxManager.enableSandboxForSession(sessionID)
          setCachedSandboxState(sessionID, true)
          
          showToast(
            input,
            "Sandbox Enabled",
            "Commands and file operations are now running in the Sandbox.",
            "success",
            sessionID,
            "enable"
          )
        } else if (isDisable) {
          log(`[SandboxControl] Manual disable requested for session ${sessionID}`)
          await sandboxManager.disableSandboxForSession(sessionID)
          setCachedSandboxState(sessionID, false)
          
          showToast(
            input,
            "Sandbox Disabled",
            "Commands and file operations are now running locally.",
            "warning",
            sessionID,
            "disable"
          )
        }
      } catch (err: any) {
        log(`[SandboxControl] Failed to ${isEnable ? 'enable' : 'disable'} sandbox:`, err)
      }
    },
    
    "experimental.chat.system.transform": async (
      input: { sessionID?: string },
      output: { system: string[] }
    ) => {
      const sessionID = input.sessionID
      if (!sessionID) return
      
      // Use cached state or fetch from manager
      let isEnabled = getCachedSandboxState(sessionID)
      if (isEnabled === null) {
        isEnabled = sandboxManager.isSandboxEnabled(sessionID)
        setCachedSandboxState(sessionID, isEnabled)
      }
      
      // Pre-defined messages for better performance
      const message = isEnabled
        ? "🟢 SANDBOX MODE ACTIVE: You are operating securely inside a containerized Sandbox. System changes are isolated. The user can disable this by typing '/sandbox off'."
        : "🔴 LOCAL MODE ACTIVE: You are operating directly on the user's local machine. Be careful with destructive commands. The user can enable the Sandbox by typing '/sandbox on'."
      
      output.system.push(message)
    }
  }
}
