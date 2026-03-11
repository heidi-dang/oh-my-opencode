import os
import sys

def check_runtime_enforcement_hook():
    print("Checking for Runtime Enforcement Guard soft-failure...")
    
    # 1. Read hook.ts
    hook_path = "src/hooks/runtime-enforcement/hook.ts"
    if not os.path.exists(hook_path):
        print(f"[FAIL] Required file not found: {hook_path}")
        return False
        
    with open(hook_path, "r") as f:
        hook_contents = f.read()
        
    # Check that it DOES NOT contain 'throw new Error("[Runtime Enforcement Guard] State claim REJECTED'
    if 'throw new Error(' in hook_contents and '[Runtime Enforcement Guard] State claim REJECTED' in hook_contents:
        print("[FAIL] The Runtime Enforcement Guard still contains a hard throw for State claim REJECTED")
        return False
        
    # Check that it DOES contain the soft failure string
    if '[REDACTED: False completion claim' not in hook_contents:
        print("[FAIL] The Runtime Enforcement Guard missing soft-redaction logic")
        return False
        
    # 2. Check the outer boundary
    transform_path = "src/plugin/messages-transform.ts"
    if not os.path.exists(transform_path):
        print(f"[FAIL] Required file not found: {transform_path}")
        return False
        
    with open(transform_path, "r") as f:
        transform_contents = f.read()
        
    # Check that try-catch is around the hook calls
    if 'try {' not in transform_contents or 'catch (' not in transform_contents or 'console.error(' not in transform_contents:
        print("[FAIL] The outer boundary src/plugin/messages-transform.ts is missing a try-catch block to prevent crash")
        return False

    print("[PASS] Runtime Enforcement guard soft-fail mechanism verified.")
    return True

if __name__ == "__main__":
    if not check_runtime_enforcement_hook():
        sys.exit(1)
    sys.exit(0)
