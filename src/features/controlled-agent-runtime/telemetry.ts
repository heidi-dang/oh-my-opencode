/**
 * CAR Telemetry — Machine-readable run logging for baseline evaluation and tuning.
 *
 * Stores every CAR run as a JSONL entry in `.runtime/car-telemetry.jsonl`.
 * Enables before/after measurement of success rates, failure classes, and false-done rates.
 */

import * as fs from "fs"
import * as path from "path"
import { log } from "../../shared/logger"
import type { TaskType } from "./types"

export interface TelemetryRecord {
  timestamp: string
  session_id: string
  task_id: string
  task_type: TaskType
  raw_prompt_length: number

  /** Did the task succeed on the first pass (no repair loops)? */
  first_pass_success: boolean

  /** Did the task ultimately succeed after all repair loops? */
  final_success: boolean

  /** Was it completed but later detected as false-done? */
  false_done_detected: boolean

  /** Total number of repair loops used */
  repair_loops_used: number

  /** Classification of the failure that caused the block/fail */
  failure_class?: "build" | "test" | "retrieval" | "drift" | "incomplete" | "timeout" | "unknown"

  /** Which verification level failed (if any)? */
  verification_level_failed?: "static" | "targeted" | "e2e" | "regression"

  /** Was the task completed or blocked? */
  completed: boolean

  /** Reason for block (if blocked) */
  blocked_reason?: string

  /** Acceptance score at completion */
  acceptance_score: { total: number; passed: number }

  /** Total wall-clock duration in ms */
  duration_ms: number
}

export class CARTelemetry {
  private static instance: CARTelemetry
  private telemetryPath: string
  private stream: fs.WriteStream | null = null

  private constructor() {
    const dir = path.join(process.cwd(), ".runtime", "car-telemetry")
    this.telemetryPath = path.join(dir, "runs.jsonl")

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      this.stream = fs.createWriteStream(this.telemetryPath, { flags: "a" })
    } catch (err) {
      log("[CARTelemetry] Failed to initialize telemetry file:", err)
    }
  }

  public static getInstance(): CARTelemetry {
    if (!CARTelemetry.instance) {
      CARTelemetry.instance = new CARTelemetry()
    }
    return CARTelemetry.instance
  }

  public record(entry: Omit<TelemetryRecord, "timestamp">): void {
    if (!this.stream) return

    const fullEntry: TelemetryRecord = {
      timestamp: new Date().toISOString(),
      ...entry,
    }

    try {
      this.stream.write(JSON.stringify(fullEntry) + "\n")
      log(`[CARTelemetry] Recorded: task=${entry.task_id} type=${entry.task_type} success=${entry.final_success} loops=${entry.repair_loops_used}`)
    } catch (err) {
      log("[CARTelemetry] Failed to write entry:", err)
    }
  }

  public close(): void {
    if (this.stream) {
      this.stream.close()
      this.stream = null
    }
  }
}

export const carTelemetry = CARTelemetry.getInstance()
