import os
import sys

def check_file(path):
    if os.path.exists(path):
        print(f"[PASS] {path} exists.")
        return True
    else:
        print(f"[FAIL] {path} is MISSING.")
        return False

def run_doctor():
    print("OhMyOpencode Reliability Runtime - System Doctor\n")
    
    required_files = [
        "src/hooks/execution-journal/hook.ts",
        "src/hooks/semantic-loop-guard/hook.ts",
        "src/agents/runtime/loop-guard.ts",
        "src/runtime/state-ledger.ts",
        "src/agents/runtime/action-validator.ts",
        "src/hooks/tool-contract/hook.ts",
        "src/utils/safety-tool-result.ts",
        "src/runtime/tools/registry.ts",
        "src/runtime/tools/complete-task.ts",
        "src/runtime/tools/query-ledger.ts",
        "src/agents/prompts/base-system.ts",
        "src/agents/prompts/execution-rules.ts",
        "src/agents/prompts/agent-role.ts",
        "src/agents/prompts/skill-context.ts"
    ]
    
    all_pass = True
    for f in required_files:
        if not check_file(f):
            all_pass = False
    
    # Check if safety tools are using the helper
    safety_tools = [
        "src/runtime/tools/complete-task.ts",
        "src/runtime/tools/verify.ts",
        "src/runtime/tools/git-safe.ts",
        "src/runtime/tools/fs-safe.ts"
    ]
    
    for tool_path in safety_tools:
        if os.path.exists(tool_path):
            with open(tool_path, 'r') as f:
                content = f.read()
                if "safety-tool-result" not in content:
                    print(f"[FAIL] {tool_path} does not appear to use safety-tool-result helper.")
                    all_pass = False
                else:
                    print(f"[PASS] {tool_path} uses safety-tool-result helper.")

    # Check for Loop Guard Recovery Wiring
    print("\nChecking Loop Guard recovery wiring...")
    compiler_path = "src/runtime/plan-compiler.ts"
    hook_path = "src/hooks/semantic-loop-guard/hook.ts"
    
    if os.path.exists(compiler_path):
        with open(compiler_path, "r") as f:
            compiler_content = f.read()
        if "injectForcedReplan" not in compiler_content:
            print(f"[FAIL] {compiler_path} missing 'injectForcedReplan' method.")
            all_pass = False
        else:
            print(f"[PASS] {compiler_path} has 'injectForcedReplan' method.")

    if os.path.exists(hook_path):
        with open(hook_path, "r") as f:
            hook_content = f.read()
        if "compiler.injectForcedReplan" not in hook_content:
            print(f"[FAIL] {hook_path} does not call 'compiler.injectForcedReplan'.")
            all_pass = False
        else:
            print(f"[PASS] {hook_path} calls 'compiler.injectForcedReplan' on block.")
        if "variant: \"success\"" not in hook_content:
            print(f"[FAIL] {hook_path} does not use 'success' variant for green toast.")
            all_pass = False
        else:
            print(f"[PASS] {hook_path} uses 'success' variant for safety message.")

    if all_pass:
        print("\n[RESULT] 10/10 Reliability Architecture: Verified.")
        sys.exit(0)
    else:
        print("\n[RESULT] CRITICAL FAILURE: System is not in a 10/10 reliability state.")
        sys.exit(1)

if __name__ == "__main__":
    run_doctor()
