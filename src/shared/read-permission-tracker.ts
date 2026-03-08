import { log } from "./logger"

/**
 * Read Permission Tracker
 * 
 * Tracks which files have been read by the agent in the current session.
 * Used to enforce "edit discipline" - you cannot edit a file you haven't read.
 */
class ReadPermissionTracker {
  private readFiles = new Map<string, Set<string>>() // sessionID -> Set<filePath>

  public recordRead(sessionID: string, filePath: string) {
    if (!this.readFiles.has(sessionID)) {
      this.readFiles.set(sessionID, new Set())
    }
    const normalizedPath = this.normalizePath(filePath)
    this.readFiles.get(sessionID)!.add(normalizedPath)
    log(`[ReadTracker] Recorded read for ${normalizedPath} in session ${sessionID}`)
  }

  public hasRead(sessionID: string, filePath: string): boolean {
    const sessionReads = this.readFiles.get(sessionID)
    if (!sessionReads) return false
    
    const normalizedPath = this.normalizePath(filePath)
    return sessionReads.has(normalizedPath)
  }

  public clearSession(sessionID: string) {
    this.readFiles.delete(sessionID)
  }

  private normalizePath(filePath: string): string {
    // Basic normalization: remove trailing slashes, absolute resolve if possible
    // In a real plugin we might want to use path.resolve()
    return filePath.trim().replace(/\/+$/, "")
  }
}

export const readTracker = new ReadPermissionTracker()
