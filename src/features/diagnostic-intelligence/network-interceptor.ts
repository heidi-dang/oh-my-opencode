/**
 * Network Diagnostic Interceptor — Intercepts HTTP, DNS, TLS, and WebSocket
 * failures at the Node.js level and generates classified diagnostics.
 *
 * Wraps the global `fetch` and `http.request` to intercept network errors
 * and classify them into actionable repair playbooks.
 */

import { log } from "../../shared/logger"
import type { ClassifiedDiagnostic, DiagnosticClass } from "./types"

export type NetworkInterceptorCallback = (diagnostic: ClassifiedDiagnostic) => void

interface NetworkErrorPattern {
  code: string | RegExp
  statusCode?: number
  diagnosticClass: DiagnosticClass
  message: string
}

const NETWORK_ERROR_PATTERNS: NetworkErrorPattern[] = [
  { code: "ECONNABORTED", diagnosticClass: "diagnostic.http-timeout", message: "HTTP request timed out (ECONNABORTED)" },
  { code: "ETIMEDOUT", diagnosticClass: "diagnostic.http-timeout", message: "HTTP request timed out (ETIMEDOUT)" },
  { code: "ECONNREFUSED", diagnosticClass: "diagnostic.http-timeout", message: "Connection refused by remote server (ECONNREFUSED)" },
  { code: "ENOTFOUND", diagnosticClass: "diagnostic.dns-resolution-failure", message: "DNS resolution failed (ENOTFOUND)" },
  { code: "EAI_AGAIN", diagnosticClass: "diagnostic.dns-resolution-failure", message: "DNS resolution temporarily failed (EAI_AGAIN)" },
  { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", diagnosticClass: "diagnostic.tls-cert-error", message: "TLS certificate validation failed" },
  { code: "CERT_HAS_EXPIRED", diagnosticClass: "diagnostic.tls-cert-error", message: "TLS certificate has expired" },
  { code: "DEPTH_ZERO_SELF_SIGNED_CERT", diagnosticClass: "diagnostic.tls-cert-error", message: "Self-signed certificate rejected" },
  { code: "ECONNRESET", diagnosticClass: "diagnostic.connection-reset", message: "Connection reset by peer (ECONNRESET)" },
  { code: "EPIPE", diagnosticClass: "diagnostic.connection-reset", message: "Broken pipe — connection dropped unexpectedly (EPIPE)" },
]

const HTTP_STATUS_PATTERNS: Array<{ status: number; diagnosticClass: DiagnosticClass; message: string }> = [
  { status: 429, diagnosticClass: "diagnostic.rate-limit-hit", message: "Rate limit exceeded (HTTP 429)" },
  { status: 413, diagnosticClass: "diagnostic.payload-too-large", message: "Payload too large (HTTP 413)" },
]

export class NetworkDiagnosticInterceptor {
  private static instance: NetworkDiagnosticInterceptor
  private subscribers: NetworkInterceptorCallback[] = []
  private isPatched = false
  private originalFetch: typeof globalThis.fetch | null = null

  private constructor() {}

  public static getInstance(): NetworkDiagnosticInterceptor {
    if (!NetworkDiagnosticInterceptor.instance) {
      NetworkDiagnosticInterceptor.instance = new NetworkDiagnosticInterceptor()
    }
    return NetworkDiagnosticInterceptor.instance
  }

  public subscribe(callback: NetworkInterceptorCallback): () => void {
    this.subscribers.push(callback)
    if (!this.isPatched) {
      this.patchFetch()
    }
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  private patchFetch() {
    if (this.isPatched) return
    this.isPatched = true
    this.originalFetch = globalThis.fetch

    const self = this
    const wrappedFetch = async function patchedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      try {
        const response = await self.originalFetch!.call(globalThis, input, init)

        // Check for HTTP status-based diagnostics
        for (const pattern of HTTP_STATUS_PATTERNS) {
          if (response.status === pattern.status) {
            self.emitDiagnostic(pattern.diagnosticClass, url, pattern.message)
          }
        }

        return response
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        const errorCode = (err as any).code || err.message

        for (const pattern of NETWORK_ERROR_PATTERNS) {
          const matches = typeof pattern.code === "string"
            ? errorCode === pattern.code || err.message.includes(pattern.code)
            : pattern.code.test(err.message)

          if (matches) {
            self.emitDiagnostic(pattern.diagnosticClass, url, `${pattern.message} — URL: ${url}`)
            break
          }
        }

        throw error
      }
    }

    // Copy static properties from original fetch (like preconnect)
    Object.assign(wrappedFetch, self.originalFetch)
    globalThis.fetch = wrappedFetch as typeof fetch
  }

  private emitDiagnostic(diagnosticClass: DiagnosticClass, url: string, message: string) {
    log(`[NetworkInterceptor] ${diagnosticClass}: ${message}`)
    const diagnostic: ClassifiedDiagnostic = {
      class: diagnosticClass,
      language: "network",
      symbol: url,
      file: "globalThis.fetch",
      line: 0,
      raw_message: message,
      severity: "error",
      source: "network-interceptor"
    }
    for (const callback of this.subscribers) {
      try {
        callback(diagnostic)
      } catch (err) {
        log(`[NetworkInterceptor] Error in subscriber: ${err}`)
      }
    }
  }

  /**
   * Classify an external error (e.g. from WebSocket or MCP connection).
   * This allows other modules to feed errors into the network diagnostic pipeline.
   */
  public classifyAndEmit(error: Error, contextUrl: string) {
    const errorCode = (error as any).code || error.message

    for (const pattern of NETWORK_ERROR_PATTERNS) {
      const matches = typeof pattern.code === "string"
        ? errorCode === pattern.code || error.message.includes(pattern.code)
        : pattern.code.test(error.message)

      if (matches) {
        this.emitDiagnostic(pattern.diagnosticClass, contextUrl, `${pattern.message} — URL: ${contextUrl}`)
        return
      }
    }

    // WebSocket-specific classification
    if (error.message.includes("WebSocket") || error.message.includes("ws://") || error.message.includes("wss://")) {
      this.emitDiagnostic("diagnostic.websocket-disconnect", contextUrl, `WebSocket disconnected: ${error.message}`)
      return
    }

    // CORS-specific classification
    if (error.message.includes("CORS") || error.message.includes("Access-Control-Allow-Origin")) {
      this.emitDiagnostic("diagnostic.cors-violation", contextUrl, `CORS violation: ${error.message}`)
    }
  }
}

export const networkInterceptor = NetworkDiagnosticInterceptor.getInstance()
