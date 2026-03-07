import subprocess
import sys
import os

def run_reliability_doctor():
    print("Running Reliability Doctor...")
    result = subprocess.run(["python3", "tools/doctor_runtime_reliability.py"])
    return result.returncode == 0

def run_tool_contract_doctor():
    print("Checking Tool Contract metadata shapes...")
    result = subprocess.run(["bun", "tools/check_tool_contract.ts"])
    if result.returncode != 0:
        print("[FAIL] One or more safety tools returned invalid metadata shape.")
    return result.returncode == 0

def run_lsp_doctor():
    print("Checking TypeScript LSP dependencies...")
    tsc_check = subprocess.run(["which", "tsc"], capture_output=True)
    lsp_check = subprocess.run(["which", "typescript-language-server"], capture_output=True)
    
    if tsc_check.returncode != 0:
        print("[FAIL] 'tsc' not found in PATH.")
    if lsp_check.returncode != 0:
        print("[FAIL] 'typescript-language-server' not found in PATH.")
        
    return tsc_check.returncode == 0 and lsp_check.returncode == 0

def run_git_doctor():
    print("Checking Git repository status...")
    git_installed = subprocess.run(["which", "git"], capture_output=True).returncode == 0
    if not git_installed:
        print("[FAIL] 'git' not found in PATH.")
        return False
    
    toplevel = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True)
    if toplevel.returncode != 0:
        print("[FAIL] Not a git repository (or any of the parent directories).")
        return False
        
    print(f"[PASS] Git detected at: {toplevel.stdout.decode().strip()}")
    return True

def run_upstream_merge_doctor():
    print("Running Upstream Capability Merge Doctor...")
    result = subprocess.run(["python3", "tools/checks/check_upstream_capability_merge.py"])
    return result.returncode == 0

def run_plan_compiler_guard_doctor():
    print("Running Plan Compiler Guard Doctor...")
    result = subprocess.run(["python3", "tools/checks/check_plan_compiler_guard.py"])
    return result.returncode == 0

def main():
    print("Starting OhMyOpencode Doctor Execution...")
    
    # Run core reliability checks
    reliability_pass = run_reliability_doctor()
    
    # Run Git checks
    git_pass = run_git_doctor()
    
    # Run Tool Contract checks
    contract_pass = run_tool_contract_doctor()
    
    # Run LSP dependency checks
    lsp_pass = run_lsp_doctor()
    
    # Run upstream merge capability checks
    upstream_pass = run_upstream_merge_doctor()
    
    # Run plan compiler guard checks
    guard_pass = run_plan_compiler_guard_doctor()
    
    if not reliability_pass or not git_pass or not contract_pass or not lsp_pass or not upstream_pass or not guard_pass:
        print("\nERROR: Doctor checks failed. System integrity compromised.")
        sys.exit(1)
        
    print("\nSUCCESS: All doctor checks passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
