/**
 * User-Facing Status — Message packs for all three tones.
 *
 * Each message table maps internal state keys to user-facing wording.
 * The formatter selects from these tables based on the active tone.
 *
 * Rules:
 *   - Never let friendly wording lie about real state
 *   - Playful tone auto-escalates to friendly during errors/blocks
 *   - Messages are deterministic (no randomization)
 */

import type { ToneMode, Severity, FormattedStatus } from "./types"

// To make defining tables easier since tone_used is injected at runtime:
type BaseStatus = { headline: string; detail?: string; severity: Severity }
type MessageTable = Record<string, BaseStatus>

// ────────────────────────────────────────────
// State transition messages
// ────────────────────────────────────────────

export const STATE_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    NEW: { headline: "Task created.", severity: "info" },
    INTERPRETING: { headline: "Interpreting the request.", severity: "info" },
    RETRIEVING: { headline: "Retrieving context from the codebase.", severity: "info" },
    PLANNED: { headline: "Plan ready. Execution starting.", severity: "success" },
    EXECUTING: { headline: "Executing changes.", severity: "info" },
    WAITING_FOR_EDIT_REVIEW: { headline: "Waiting for edit review.", severity: "warn" },
    WAITING_FOR_BACKGROUND_PROCESS: { headline: "Waiting for a background process to complete.", severity: "warn" },
    VERIFYING: { headline: "Verification in progress.", severity: "info" },
    REPAIRING: { headline: "Repair pass started.", severity: "warn" },
    STALL_DETECTED: { headline: "Stall detected. Recovery starting.", severity: "error" },
    AUTO_RECOVERING: { headline: "Automatic recovery in progress.", severity: "warn" },
    SUBAGENT_DEBUGGING: { headline: "Debug sub-agent spawned.", severity: "warn" },
    DONE: { headline: "Task completed and verified.", severity: "success" },
    BLOCKED: { headline: "Task blocked.", severity: "error" },
  },

  friendly: {
    NEW: { headline: "Heidi picked up a new task.", severity: "info" },
    INTERPRETING: { headline: "Heidi is reading the request carefully.", severity: "info" },
    RETRIEVING: { headline: "Heidi is gathering context from the codebase.", severity: "info" },
    PLANNED: { headline: "Heidi has a plan and is starting now.", severity: "success" },
    EXECUTING: { headline: "Heidi is working through the changes.", severity: "info" },
    WAITING_FOR_EDIT_REVIEW: { headline: "Heidi is waiting for an edit review before proceeding.", severity: "warn" },
    WAITING_FOR_BACKGROUND_PROCESS: { headline: "Heidi is waiting for a background process to finish.", severity: "warn" },
    VERIFYING: { headline: "Heidi is double-checking the result before wrapping up.", severity: "info" },
    REPAIRING: { headline: "Heidi found an issue and is fixing it.", severity: "warn" },
    STALL_DETECTED: { headline: "Heidi noticed something stalled and is recovering automatically.", severity: "error" },
    AUTO_RECOVERING: { headline: "Heidi is running automatic recovery.", severity: "warn" },
    SUBAGENT_DEBUGGING: { headline: "Heidi spawned a helper agent to investigate the issue.", severity: "warn" },
    DONE: { headline: "Heidi finished the task and verified the result before wrapping up.", severity: "success" },
    BLOCKED: { headline: "Heidi is blocked right now. Here is the exact reason:", severity: "error" },
  },

  playful: {
    NEW: { headline: "Heidi just picked up a fresh one.", severity: "info" },
    INTERPRETING: { headline: "Heidi is decoding the mission brief.", severity: "info" },
    RETRIEVING: { headline: "Heidi is pulling files off the shelf.", severity: "info" },
    PLANNED: { headline: "Heidi mapped it out — here we go.", severity: "success" },
    EXECUTING: { headline: "Heidi is in the zone, making edits.", severity: "info" },
    WAITING_FOR_EDIT_REVIEW: { headline: "Heidi is holding the door open — your turn.", severity: "warn" },
    WAITING_FOR_BACKGROUND_PROCESS: { headline: "Heidi is waiting on something in the background.", severity: "warn" },
    VERIFYING: { headline: "Heidi is kicking the tires before shipping.", severity: "info" },
    REPAIRING: { headline: "Heidi hit a bump and is patching the road.", severity: "warn" },
    // Playful auto-escalates to friendly for error/recovery states
    STALL_DETECTED: { headline: "Heidi noticed something stalled and is recovering automatically.", severity: "error" },
    AUTO_RECOVERING: { headline: "Heidi is running automatic recovery.", severity: "warn" },
    SUBAGENT_DEBUGGING: { headline: "Heidi called in backup to check the engine.", severity: "warn" },
    DONE: { headline: "All done — Heidi checked her work twice.", severity: "success" },
    BLOCKED: { headline: "Heidi hit a wall and needs a hand.", severity: "error" },
  },
}

// ────────────────────────────────────────────
// Event messages (actions within states)
// ────────────────────────────────────────────

export const EVENT_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    tool_started: { headline: "Tool started.", severity: "info" },
    repair_pass_started: { headline: "Repair pass started.", severity: "warn" },
    repair_pass_failed: { headline: "Repair pass failed.", severity: "error" },
    subagent_spawned: { headline: "Helper agent spawned.", severity: "info" },
    task_blocked: { headline: "Task became blocked.", severity: "error" },
    task_completed: { headline: "Task marked complete.", severity: "success" },
    waiting_for_review: { headline: "Waiting for review.", severity: "info" },
    waiting_for_background_task: { headline: "Waiting for background task.", severity: "info" },
    waiting_for_verification_start: { headline: "Waiting for verification.", severity: "info" },
    waiting_for_next_step: { headline: "Waiting for next step.", severity: "info" },
  },

  friendly: {
    tool_started: { headline: "Heidi is starting a new step.", severity: "info" },
    repair_pass_started: { headline: "Heidi is attempting a repair pass.", severity: "warn" },
    repair_pass_failed: { headline: "That repair pass didn't work. Heidi is adjusting.", severity: "error" },
    subagent_spawned: { headline: "Heidi brought in a helper agent to investigate automatically.", severity: "info" },
    task_blocked: { headline: "The task is now blocked and needs attention.", severity: "error" },
    task_completed: { headline: "Heidi successfully completed the task.", severity: "success" },
    waiting_for_review: { headline: "Heidi is waiting for your review.", severity: "info" },
    waiting_for_background_task: { headline: "Heidi is waiting for background work to wrap up.", severity: "info" },
    waiting_for_verification_start: { headline: "Heidi is waiting to begin verification.", severity: "info" },
    waiting_for_next_step: { headline: "Heidi is waiting on the next step before continuing.", severity: "info" },
  },

  playful: {
    tool_started: { headline: "Heidi is firing up the next tool.", severity: "info" },
    repair_pass_started: { headline: "Heidi is rolling up her sleeves for a fix.", severity: "warn" },
    repair_pass_failed: { headline: "That pass didn't quite stick. Trying again.", severity: "error" },
    subagent_spawned: { headline: "Heidi tagged in a specialist.", severity: "info" },
    task_blocked: { headline: "Heidi hit a snag and is blocked.", severity: "error" },
    task_completed: { headline: "Nailed it. Task complete.", severity: "success" },
    waiting_for_review: { headline: "Heidi is pausing here so you can take a look.", severity: "info" },
    waiting_for_background_task: { headline: "Heidi is tapping her foot waiting on the background process.", severity: "info" },
    waiting_for_verification_start: { headline: "Heidi is queuing up the final checks.", severity: "info" },
    waiting_for_next_step: { headline: "Heidi is ready when you are.", severity: "info" },
  },
}

// ────────────────────────────────────────────
// Tool result messages
// ────────────────────────────────────────────

export const TOOL_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    success: { headline: "Tool executed successfully.", severity: "success" },
    failure: { headline: "Tool execution failed.", severity: "error" },
    timeout: { headline: "Tool timed out.", severity: "warn" },
  },

  friendly: {
    success: { headline: "That step completed successfully.", severity: "success" },
    failure: { headline: "That step did not work, so Heidi is adjusting the approach.", severity: "error" },
    timeout: { headline: "That step took too long. Heidi is trying a different path.", severity: "warn" },
  },

  playful: {
    success: { headline: "That went smoothly.", severity: "success" },
    failure: { headline: "That step didn't land — Heidi is pivoting.", severity: "error" },
    timeout: { headline: "That step ran out of time. Heidi is rerouting.", severity: "warn" },
  },
}

// ────────────────────────────────────────────
// Recovery event messages
// ────────────────────────────────────────────

export const RECOVERY_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    recovery_started: { headline: "Recovery started.", severity: "info" },
    reconcile_attempt: { headline: "Reconciling state.", severity: "info" },
    nudge_attempt: { headline: "Nudging task to next phase.", severity: "info" },
    process_sync: { headline: "Syncing background processes.", severity: "info" },
    subagent_spawned: { headline: "Debug sub-agent spawned.", severity: "warn" },
    recovery_succeeded: { headline: "Recovery succeeded.", severity: "success" },
    recovery_failed: { headline: "Recovery failed. Task blocked.", severity: "error" },
    edit_review_wait_stall: { headline: "Edit review wait stall detected.", severity: "warn" },
    background_tool_hang: { headline: "Background tool hang detected.", severity: "warn" },
    post_tool_continuation_lost: { headline: "Post-tool continuation lost.", severity: "warn" },
    verification_never_started: { headline: "Verification never started.", severity: "warn" },
    completion_gate_deadlock: { headline: "Completion gate deadlock detected.", severity: "error" },
    unknown_runtime_stall: { headline: "Unknown runtime stall detected.", severity: "error" },
  },

  friendly: {
    recovery_started: { headline: "Heidi is diagnosing what went wrong.", severity: "info" },
    reconcile_attempt: { headline: "Heidi is checking the current state for known issues.", severity: "info" },
    nudge_attempt: { headline: "Heidi is gently pushing the task to continue.", severity: "info" },
    process_sync: { headline: "Heidi is checking on background processes.", severity: "info" },
    subagent_spawned: { headline: "Heidi spun up a helper agent to investigate the issue.", severity: "warn" },
    recovery_succeeded: { headline: "Recovery worked — Heidi is back on track.", severity: "success" },
    recovery_failed: { headline: "Automatic recovery could not safely continue. The task is now blocked with a diagnostic.", severity: "error" },
    edit_review_wait_stall: { headline: "Heidi is waiting for an edit/review confirmation to proceed.", severity: "warn" },
    background_tool_hang: { headline: "Heidi detected a background process that may be hung.", severity: "warn" },
    post_tool_continuation_lost: { headline: "Heidi detected a stalled continuation after a tool completed.", severity: "warn" },
    verification_never_started: { headline: "Heidi noticed that verification did not start after execution.", severity: "warn" },
    completion_gate_deadlock: { headline: "Heidi detected a completion gate deadlock.", severity: "error" },
    unknown_runtime_stall: { headline: "Heidi detected a stalled runtime state and is recovering.", severity: "error" },
  },

  playful: {
    recovery_started: { headline: "Heidi is looking under the hood.", severity: "info" },
    reconcile_attempt: { headline: "Heidi is checking the wiring.", severity: "info" },
    nudge_attempt: { headline: "Heidi gave it a gentle push.", severity: "info" },
    process_sync: { headline: "Heidi is checking the pulse of background work.", severity: "info" },
    subagent_spawned: { headline: "Heidi called in a specialist.", severity: "warn" },
    // Playful auto-escalates to friendly for failure outcomes
    recovery_succeeded: { headline: "Recovery worked — Heidi is back on track.", severity: "success" },
    recovery_failed: { headline: "Automatic recovery could not safely continue. The task is now blocked with a diagnostic.", severity: "error" },
    edit_review_wait_stall: { headline: "Heidi is waiting for an edit/review confirmation to proceed.", severity: "warn" },
    background_tool_hang: { headline: "Heidi detected a background process that may be hung.", severity: "warn" },
    post_tool_continuation_lost: { headline: "Heidi detected a stalled continuation after a tool completed.", severity: "warn" },
    verification_never_started: { headline: "Heidi noticed that verification did not start after execution.", severity: "warn" },
    completion_gate_deadlock: { headline: "Heidi detected a completion gate deadlock.", severity: "error" },
    unknown_runtime_stall: { headline: "Heidi detected a stalled runtime state and is recovering.", severity: "error" },
  },
}

// ────────────────────────────────────────────
// Verification result messages
// ────────────────────────────────────────────

export const VERIFICATION_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    build_pass: { headline: "Build passed.", severity: "success" },
    build_fail: { headline: "Build failed.", severity: "error" },
    test_pass: { headline: "Tests passed.", severity: "success" },
    test_fail: { headline: "Tests failed.", severity: "error" },
    lint_pass: { headline: "Lint check passed.", severity: "success" },
    lint_warn: { headline: "Lint warnings found.", severity: "warn" },
    lint_fail: { headline: "Lint check failed.", severity: "error" },
    all_pass: { headline: "All verification steps passed.", severity: "success" },
    partial_pass: { headline: "Some verification steps failed.", severity: "warn" },
  },

  friendly: {
    build_pass: { headline: "Build is clean.", severity: "success" },
    build_fail: { headline: "Build failed — Heidi is looking into it.", severity: "error" },
    test_pass: { headline: "All tests are passing.", severity: "success" },
    test_fail: { headline: "Some tests failed — Heidi is investigating.", severity: "error" },
    lint_pass: { headline: "Lint check looks good.", severity: "success" },
    lint_warn: { headline: "A few lint warnings came up.", severity: "warn" },
    lint_fail: { headline: "Lint check found errors.", severity: "error" },
    all_pass: { headline: "Everything checks out — build, tests, and lint all clean.", severity: "success" },
    partial_pass: { headline: "Some checks passed, but others need attention.", severity: "warn" },
  },

  playful: {
    build_pass: { headline: "Build is squeaky clean.", severity: "success" },
    build_fail: { headline: "Build tripped — Heidi is on it.", severity: "error" },
    test_pass: { headline: "Tests are all green.", severity: "success" },
    test_fail: { headline: "Some tests went red — Heidi is debugging.", severity: "error" },
    lint_pass: { headline: "Lint gave the thumbs up.", severity: "success" },
    lint_warn: { headline: "Lint had a few things to say.", severity: "warn" },
    lint_fail: { headline: "Lint found some issues to clean up.", severity: "error" },
    all_pass: { headline: "Clean sweep — everything passed.", severity: "success" },
    partial_pass: { headline: "Mixed results — some checks need another look.", severity: "warn" },
  },
}

// ────────────────────────────────────────────
// Blocked condition messages
// ────────────────────────────────────────────

export const BLOCKED_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    missing_context: { headline: "Blocked: missing required context.", severity: "warn" },
    user_input_required: { headline: "Blocked: user input required.", severity: "info" },
    unrecoverable_error: { headline: "Blocked: unrecoverable error.", severity: "error" },
    max_retries_exceeded: { headline: "Blocked: maximum retries exceeded.", severity: "error" },
    dependency_failure: { headline: "Blocked: dependency failure.", severity: "error" },
  },

  friendly: {
    missing_context: { headline: "Heidi needs more context to continue.", severity: "warn" },
    user_input_required: { headline: "Heidi needs your input before continuing.", severity: "info" },
    unrecoverable_error: { headline: "Heidi ran into an error she cannot fix automatically.", severity: "error" },
    max_retries_exceeded: { headline: "Heidi tried multiple times but could not resolve the issue.", severity: "error" },
    dependency_failure: { headline: "A dependency failed and Heidi cannot proceed until it is resolved.", severity: "error" },
  },

  playful: {
    missing_context: { headline: "Heidi needs a few more puzzle pieces.", severity: "warn" },
    user_input_required: { headline: "Heidi needs your input — the ball is in your court.", severity: "info" },
    // Playful auto-escalates to friendly for serious blocks
    unrecoverable_error: { headline: "Heidi ran into an error she cannot fix automatically.", severity: "error" },
    max_retries_exceeded: { headline: "Heidi tried multiple times but could not resolve the issue.", severity: "error" },
    dependency_failure: { headline: "A dependency failed and Heidi cannot proceed until it is resolved.", severity: "error" },
  },
}

// ────────────────────────────────────────────
// Completion messages
// ────────────────────────────────────────────

export const COMPLETION_MESSAGES: Record<string, MessageTable> = {
  neutral: {
    verified_complete: { headline: "Task completed and verified.", severity: "success" },
    complete_no_verify: { headline: "Task completed. No verification was run.", severity: "info" },
    partial_complete: { headline: "Task partially completed.", severity: "warn" },
    blocked_by_firewall: { headline: "Task completion refused by firewall.", severity: "error" },
  },

  friendly: {
    verified_complete: { headline: "Heidi finished the task and verified everything is clean.", severity: "success" },
    complete_no_verify: { headline: "Heidi finished the task. No verification step was available.", severity: "info" },
    partial_complete: { headline: "Heidi completed part of the task. Some items still need attention.", severity: "warn" },
    blocked_by_firewall: { headline: "Heidi is not calling this done yet because verification is still incomplete.", severity: "error" },
  },

  playful: {
    verified_complete: { headline: "All done — Heidi checked her work and everything looks great.", severity: "success" },
    complete_no_verify: { headline: "Heidi wrapped it up, though there was no verification to run.", severity: "info" },
    partial_complete: { headline: "Heidi got most of it done, but a couple items are still open.", severity: "warn" },
    blocked_by_firewall: { headline: "Not so fast! Heidi is holding off until all checks pass.", severity: "error" },
  },
}
