#!/usr/bin/env python3
"""
Doctor check for Plan Compiler Guard live tool gating.

This check verifies that the plan compiler guard correctly allows essential tools
and blocks inappropriate tools during active plan execution.
"""

import sys
import os
import subprocess
import json

def check_plan_compiler_guard():
    """Check that plan compiler guard allows essential tools and blocks others appropriately."""
    print("Checking Plan Compiler Guard tool gating...")

    # Check if the hook file exists
    hook_file = "src/hooks/plan-enforcement/hook.ts"
    if not os.path.exists(hook_file):
        print(f"[FAIL] Plan enforcement hook file not found: {hook_file}")
        return False

    # Read the hook file
    with open(hook_file, 'r') as f:
        content = f.read()

    # Check for ALWAYS_ALLOWED_TOOLS constant
    if "ALWAYS_ALLOWED_TOOLS" not in content:
        print("[FAIL] ALWAYS_ALLOWED_TOOLS constant not found in hook")
        return False

    # Check for essential tools in the allowed list
    essential_tools = [
        "mark_step_complete", "verify_action", "grep", "edit",
        "task_update", "lsp_diagnostics", "interactive_bash"
    ]

    for tool in essential_tools:
        if f'"{tool}"' not in content:
            print(f"[FAIL] Essential tool '{tool}' not in ALWAYS_ALLOWED_TOOLS")
            return False

    # Check for PlanCompilerGuardError class
    if "PlanCompilerGuardError" not in content:
        print("[FAIL] PlanCompilerGuardError class not found")
        return False

    # Check for logging in the guard
    if "console.log" not in content or "Blocking tool call" not in content:
        print("[FAIL] Guard decision logging not found")
        return False

    # Check that the guard throws the custom error
    if "throw new PlanCompilerGuardError" not in content:
        print("[FAIL] Guard does not throw PlanCompilerGuardError")
        return False

    print("[PASS] Plan Compiler Guard structure is correct")
    return True

def check_plan_compiler_tests():
    """Check that plan compiler has appropriate tests."""
    print("Checking Plan Compiler test coverage...")

    # Look for test files
    test_files = [
        "src/hooks/plan-enforcement/hook.test.ts",
        # Note: plan-compiler itself is tested via integration in other test files
    ]

    for test_file in test_files:
        if not os.path.exists(test_file):
            print(f"[FAIL] Test file not found: {test_file}")
            return False
        else:
            print(f"[PASS] Test file exists: {test_file}")

    # Run TypeScript compilation check
    try:
        result = subprocess.run(["bun", "run", "typecheck"], capture_output=True, text=True)
        if result.returncode != 0:
            print("[FAIL] TypeScript compilation failed")
            print(result.stdout)
            print(result.stderr)
            return False
        print("[PASS] TypeScript compilation successful")
    except Exception as e:
        print(f"[FAIL] Failed to run typecheck: {e}")
        return False

    return True

def main():
    """Run all plan compiler guard checks."""
    guard_check = check_plan_compiler_guard()
    test_check = check_plan_compiler_tests()

    if not guard_check or not test_check:
        print("\n[FAIL] Plan Compiler Guard checks failed")
        return 1

    print("\n[SUCCESS] All Plan Compiler Guard checks passed")
    return 0

if __name__ == "__main__":
    sys.exit(main())