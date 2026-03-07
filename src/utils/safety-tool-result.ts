/**
 * Shared Safety Tool Result Interface
 * 
 * Consistent structure for all safety-critical tools (git, fs, verify, complete).
 * This ensures the tool-contract hook can reliably validate execution.
 */

export interface StateChange {
    type: string;
    key: string;
    details?: any;
}

export interface SafetyToolResult {
    success: boolean;      // Did the tool itself execute without internal error?
    verified: boolean;     // Did the action perform as expected (e.g. test passed, file exists)?
    changedState: boolean; // Did this action modify the persistent system state?
    stateChange?: StateChange; // Required if changedState is true
    message?: string;      // Human readable summary
}

/**
 * Creates a standard successful safety tool result.
 */
export function createSuccessResult(params: {
    verified: boolean;
    changedState: boolean;
    stateChange?: StateChange;
    message?: string;
}): SafetyToolResult {
    const result: SafetyToolResult = {
        success: true,
        verified: params.verified,
        changedState: params.changedState,
        message: params.message
    };

    if (params.changedState) {
        if (!params.stateChange) {
            throw new Error("[Safety Helper] 'stateChange' metadata is required when 'changedState' is true.");
        }
        result.stateChange = params.stateChange;
    }

    return result;
}

/**
 * Creates a standard failure result (tool execution error).
 */
export function createFailureResult(message: string): SafetyToolResult {
    return {
        success: false,
        verified: false,
        changedState: false,
        message
    };
}
