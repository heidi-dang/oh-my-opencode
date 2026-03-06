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
        "src/agents/runtime/agent-runner.ts",
        "src/agents/runtime/tool-runner.ts",
        "src/agents/runtime/loop-guard.ts",
        "src/agents/runtime/state-ledger.ts",
        "src/agents/runtime/context-builder.ts",
        "src/agents/runtime/action-validator.ts",
        "src/hooks/tool-contract/hook.ts",
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
            
    if all_pass:
        print("\n[RESULT] 10/10 Reliability Architecture: Verified.")
        sys.exit(0)
    else:
        print("\n[RESULT] CRITICAL FAILURE: System is not in a 10/10 reliability state.")
        sys.exit(1)

if __name__ == "__main__":
    run_doctor()
