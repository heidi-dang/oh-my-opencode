import subprocess
import sys
import os
import argparse

def run_cmd(cmd, cwd=None, capture=True):
    try:
        result = subprocess.run(cmd, cwd=cwd, text=True, capture_output=capture, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        if capture:
            return None
        return False

def run_prepr_checks():
    print("\nStarting Pre-PR Doctor Checks...")
    
    # Check if working directory is clean
    status = run_cmd(["git", "status", "--porcelain"])
    if status:
        print("\nERROR: Repository is dirty. Please commit or stash changes before running pre-PR checks.")
        print(status)
        return False
        
    # Check for in-progress operations
    git_dir = run_cmd(["git", "rev-parse", "--git-dir"])
    if os.path.isdir(os.path.join(git_dir, "rebase-merge")) or os.path.isdir(os.path.join(git_dir, "rebase-apply")):
        print("\nERROR: Rebase in progress. Finish or abort to continue.")
        return False
        
    print("Fetching latest origin/main...")
    if subprocess.run(["git", "fetch", "origin", "main"], capture_output=True).returncode != 0:
        print("\nERROR: Failed to fetch origin/main.")
        return False

    current_branch = run_cmd(["git", "branch", "--show-current"])
    if current_branch == "main":
        print("\nERROR: You are on the main branch. Please create a feature branch for your PR.")
        return False

    print("Checking branch freshness...")
    behind = run_cmd(["git", "rev-list", "--count", f"{current_branch}..origin/main"])
    if not behind or int(behind) > 0:
        print(f"\nERROR: Branch is behind origin/main by {behind} commits.")
        print("Please run `tools/start-task.sh <branch-name>` to rebase onto latest main.")
        return False

    print("Computing merge-base...")
    merge_base = run_cmd(["git", "merge-base", current_branch, "origin/main"])
    print(f"Merge base commit: {merge_base[:7]}")

    print("Detecting overlapping files...")
    branch_files = set(run_cmd(["git", "diff", "--name-only", f"{merge_base}..{current_branch}"]).split('\n'))
    main_files = set(run_cmd(["git", "diff", "--name-only", f"{merge_base}..origin/main"]).split('\n'))
    
    branch_files.discard('')
    main_files.discard('')
    
    overlapping = branch_files.intersection(main_files)
    
    print(f"Files changed on current branch: {len(branch_files)}")
    print(f"Files changed on origin/main: {len(main_files)}")
    
    if overlapping:
        print("\n⚠️  WARNING: Overlapping files detected. Both branches changed:")
        for f in overlapping:
            print(f"  - {f}")
            
        hot_files = ['package.json', 'bun.lock', 'src/config/', 'src/plugin/', 'tools/']
        for f in overlapping:
            for hot in hot_files:
                if hot in f:
                    print(f"\n🚨 HIGH SEVERITY: Hot file '{f}' was modified concurrently.")

    print("\nSimulating merge to verify conflict status...")
    sim_result = subprocess.run(
        ["git", "merge-tree", merge_base, current_branch, "origin/main"], 
        capture_output=True, text=True
    )
    
    if "=====" in sim_result.stdout or "=======" in sim_result.stdout or sim_result.returncode != 0:
        print("\nERROR: Simulated merge detected conflicts! You must resolve them before opening a PR.")
        print(sim_result.stdout)
        print("\nRun this command to fix:")
        print(f"  git rebase origin/main")
        return False

    print("\n✅ Pre-PR checks passed! No simulated conflicts.")
    return True

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
    parser = argparse.ArgumentParser(description="Oh My OpenCode Doctor")
    parser.add_argument("--full", action="store_true", help="Run full diagnostic suite including pre-PR checks")
    parser.add_argument("--prepr", action="store_true", help="Run strictly the pre-PR verification gate")
    args = parser.parse_args()

    if args.prepr:
        success = run_prepr_checks()
        if not success:
            sys.exit(1)
        sys.exit(0)

    print("Starting OhMyOpencode Doctor Execution...")
    
    if args.full:
        prepr_pass = run_prepr_checks()
        if not prepr_pass:
            print("\nERROR: Doctor pre-PR checks failed.")
            sys.exit(1)

    reliability_pass = run_reliability_doctor()
    git_pass = run_git_doctor()
    contract_pass = run_tool_contract_doctor()
    lsp_pass = run_lsp_doctor()
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
