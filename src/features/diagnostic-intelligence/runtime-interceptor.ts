import { log } from "../../shared/logger"
import type { ClassifiedDiagnostic } from "./types"
import { parse, StackFrame } from "error-stack-parser-es"
import { readFileSync } from "fs"

export type RuntimeInterceptorCallback = (diagnostic: ClassifiedDiagnostic) => void

export class RuntimeDiagnosticInterceptor {
  private static instance: RuntimeDiagnosticInterceptor
  private isListening = false
  private subscribers: RuntimeInterceptorCallback[] = []

  private constructor() {}

  public static getInstance(): RuntimeDiagnosticInterceptor {
    if (!RuntimeDiagnosticInterceptor.instance) {
      RuntimeDiagnosticInterceptor.instance = new RuntimeDiagnosticInterceptor()
    }
    return RuntimeDiagnosticInterceptor.instance
  }

  public subscribe(callback: RuntimeInterceptorCallback): () => void {
    this.subscribers.push(callback)
    if (!this.isListening) {
      this.startListening()
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private startListening() {
    this.isListening = true
    
    // Uncaught Exceptions
    process.on("uncaughtException", (error: Error) => {
      log(`[RuntimeInterceptor] uncaughtException captured: ${error.message}`)
      const diagnostic = this.buildDiagnosticFromError(error, "diagnostic.uncaught-exception")
      if (diagnostic) {
        this.notifySubscribers(diagnostic)
      }
    })

    // Unhandled Promise Rejections
    process.on("unhandledRejection", (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      log(`[RuntimeInterceptor] unhandledRejection captured: ${error.message}`)
      const diagnostic = this.buildDiagnosticFromError(error, "diagnostic.unhandled-promise-rejection")
      if (diagnostic) {
        this.notifySubscribers(diagnostic)
      }
    })
  }

  private notifySubscribers(diagnostic: ClassifiedDiagnostic) {
    for (const callback of this.subscribers) {
      try {
        callback(diagnostic)
      } catch (err) {
        log(`[RuntimeInterceptor] Error in subscriber: ${err}`)
      }
    }
  }

  private buildDiagnosticFromError(error: Error, diagClass: "diagnostic.uncaught-exception" | "diagnostic.unhandled-promise-rejection"): ClassifiedDiagnostic | null {
    try {
      const parsed = parse(error)
      // Find the first frame that belongs to our codebase (not node_modules or internal)
      const userFrame = parsed.find((frame: StackFrame) => 
        frame.fileName && 
        !frame.fileName.includes("node_modules") && 
        frame.fileName.startsWith("/") &&
        (frame.fileName.endsWith(".ts") || frame.fileName.endsWith(".js"))
      )

      if (!userFrame || !userFrame.fileName || !userFrame.lineNumber) {
        return null
      }

      // Try to extract the snippet context
      let rawMessage = error.message
      try {
        const fileContent = readFileSync(userFrame.fileName, "utf-8")
        const lines = fileContent.split("\n")
        const errorLine = lines[userFrame.lineNumber - 1]
        if (errorLine) {
          rawMessage = `${error.message}\nAt: \`${errorLine.trim()}\``
        }
      } catch (e) {
        // Ignore file read bounds errors
      }

      return {
        class: diagClass,
        language: "runtime",
        symbol: userFrame.functionName || "unknown",
        file: userFrame.fileName,
        line: userFrame.lineNumber,
        column: userFrame.columnNumber,
        raw_message: rawMessage,
        severity: "error",
        source: "node-process"
      }
    } catch (parseErr) {
      log(`[RuntimeInterceptor] Failed to parse stack: ${parseErr}`)
      return null
    }
  }
}

export const runtimeInterceptor = RuntimeDiagnosticInterceptor.getInstance()
