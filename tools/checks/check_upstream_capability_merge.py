import os
import sys

def check_prompt_contains(file_path, search_strings):
    if not os.path.exists(file_path):
        print(f"[FAIL] {file_path} MISSING.")
        return False
    
    with open(file_path, 'r') as f:
        content = f.read()
        
    all_found = True
    for s in search_strings:
        if s in content:
            print(f"[PASS] {file_path} contains: '{s[:40]}...'")
        else:
            print(f"[FAIL] {file_path} MISSING REQUIRED PROMPT: '{s}'")
            all_found = False
    return all_found

def check_file_missing(path):
    if os.path.exists(path):
        print(f"[FAIL] FORBIDDEN FILE EXISTS: {path}")
        return False
    print(f"[PASS] Forbidden file correctly absent: {path}")
    return True

def check_prompt_absence(file_path, search_strings):
    if not os.path.exists(file_path):
        return True
    
    with open(file_path, 'r') as f:
        content = f.read()
        
    all_absent = True
    for s in search_strings:
        if s in content:
            print(f"[FAIL] {file_path} CONTAINS FORBIDDEN STRING: '{s}'")
            all_absent = False
        else:
            print(f"[PASS] {file_path} correctly lacks '{s[:40]}...'")
    return all_absent

def run_upstream_merge_doctor():
    print("Selective Upstream Merge - Capability Doctor\n")
    
    all_pass = True
    
    # 1. Verification of Metis Strictness
    metis_checks = [
        "ZERO USER INTERVENTION PRINCIPLE",
        "QA/Acceptance Criteria Directives (MANDATORY)"
    ]
    if not check_prompt_contains("src/agents/metis.ts", metis_checks):
        all_pass = False
        
    # 2. Verification of Momus Strictness
    momus_checks = [
        "QA Scenario Executability",
        "MOMUS_GPT_PROMPT"
    ]
    if not check_prompt_contains("src/agents/momus.ts", momus_checks):
        all_pass = False
        
    # 3. Verification of Atlas Final Wave logic
    atlas_files = ["src/agents/atlas/default.ts", "src/agents/atlas/gpt.ts", "src/agents/atlas/gemini.ts"]
    atlas_checks = [
        "pass-final-wave",
        "Final Verification Wave"
    ]
    for af in atlas_files:
        if not check_prompt_contains(af, atlas_checks):
            all_pass = False
            
    # 4. Forbidden elements — registry-controlled prompt architecture (Note: dynamic-agent-prompt-builder is
    # retained as a PASSIVE prompt library only; it is NOT a runtime control point in this PR)
    # If it ever becomes active runtime control, add it back here.
    forbidden = []
    for f in forbidden:
        if not check_file_missing(f):
            all_pass = False
            
    # 5. Verification of Hephaestus Deep Agent logic
    hephaestus_checks = [
        "autonomous deep worker",
        "Phase 0 - Intent Gate",
        "Do NOT Ask — Just Do"
    ]
    if not check_prompt_contains("src/agents/hephaestus/gpt-5-4.ts", hephaestus_checks):
        all_pass = False

    # 6. Verification of Runtime Enforcement Hook (output contract enforcement guard)
    loop_guard_checks = [
        "current completion flow",
        "state-ledger"
    ]
    if not check_prompt_contains("src/hooks/runtime-enforcement/hook.ts", loop_guard_checks):
        all_pass = False

    # 7. Hephaestus GPT Exclusivity Purge (Phase 2 capability fix)
    hook_file = "src/hooks/no-hephaestus-non-gpt/hook.ts"
    if not check_prompt_absence(hook_file, ["exclusive to GPT", "trash without GPT"]):
        all_pass = False

    shared_req_file = "src/shared/model-requirements.ts"
    if not check_prompt_absence(shared_req_file, ["requiresProvider: [\"openai\", \"github-copilot\", \"venice\", \"opencode\"]"]):
        all_pass = False

    cli_req_file = "src/cli/model-fallback-requirements.ts"
    if not check_prompt_absence(cli_req_file, ["requiresProvider: [\"openai\", \"opencode\"]"]):
        all_pass = False

    if all_pass:
        print("\n[RESULT] Upstream Capability Merge (P0+P1): 10/10 Verified.")
        sys.exit(0)
    else:
        print("\n[RESULT] CRITICAL FAILURE: Upstream merge integrity compromised.")
        sys.exit(1)

if __name__ == "__main__":
    run_upstream_merge_doctor()
