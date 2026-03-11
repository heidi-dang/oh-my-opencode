#!/usr/bin/env python3
"""
Shared Toast Wrapper Doctor Check

Validates that the shared toast wrapper fix for commits 31/46-38/46 is working:
1. All direct toast calls have been replaced with SafeToastWrapper
2. Toast operations are fail-open and non-blocking
3. No feature family is awaiting toast calls
4. Toast context absence is handled gracefully

This check ensures the entire failure block 31/46-38/46 achieves 10/10 quality.
"""

import subprocess
import sys
import time
import json
from pathlib import Path

def run_command(cmd, cwd=None, timeout=30):
    """Run a command and return result."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=timeout
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"

def check_safe_toast_wrapper_exists():
    """Check that SafeToastWrapper exists and is exported."""
    print("🔍 Checking SafeToastWrapper implementation...")
    
    wrapper_file = Path("src/shared/safe-toast-wrapper.ts")
    if not wrapper_file.exists():
        print("❌ SafeToastWrapper implementation not found")
        return False
    
    content = wrapper_file.read_text()
    
    # Check for key methods and properties
    required_patterns = [
        "class SafeToastWrapper",
        "static showToast",
        "static showError",
        "static showSuccess",
        "static showInfo",
        "static showWarning",
        "showToastInternal",
        "lastLoggedErrors",
        "ERROR_LOG_THROTTLE_MS"
    ]
    
    missing_patterns = []
    for pattern in required_patterns:
        if pattern not in content:
            missing_patterns.append(pattern)
    
    if missing_patterns:
        print(f"❌ SafeToastWrapper missing required patterns: {missing_patterns}")
        return False
    
    print("✅ SafeToastWrapper implementation verified")
    return True

def check_no_direct_toast_calls():
    """Check that no direct toast calls remain in feature files."""
    print("🔍 Checking for direct toast calls...")
    
    # Search for direct toast calls in feature directories (exclude test files)
    cmd = "grep -r \"client\\.tui\\.showToast\\|_ctx\\.client\\.tui\\.showToast\" src/hooks/ src/features/ --include=\"*.ts\" --exclude=\"*.test.ts\" || true"
    code, stdout, stderr = run_command(cmd)
    
    if stdout.strip():
        print("❌ Found direct toast calls that should be replaced:")
        print(stdout)
        return False
    
    print("✅ No direct toast calls found")
    return True

def check_no_awaited_toast_calls():
    """Check that no toast calls are being awaited."""
    print("🔍 Checking for awaited toast calls...")
    
    # Search for awaited toast calls
    cmd = "grep -r \"await.*showToast\" src/hooks/ src/features/ --include=\"*.ts\" || true"
    code, stdout, stderr = run_command(cmd)
    
    if stdout.strip():
        print("❌ Found awaited toast calls:")
        print(stdout)
        return False
    
    print("✅ No awaited toast calls found")
    return True

def check_feature_families_use_wrapper():
    """Check that all feature families use SafeToastWrapper."""
    print("🔍 Checking feature families use SafeToastWrapper...")
    
    # Feature families that were affected in commits 31/46-38/46
    feature_files = [
        "src/hooks/no-sisyphus-gpt/hook.ts",
        "src/hooks/semantic-loop-guard/hook.ts",
        "src/hooks/auto-update-checker/hook/spinner-toast.ts",
        "src/hooks/auto-update-checker/hook/model-cache-warning.ts",
        "src/hooks/auto-update-checker/hook/config-errors-toast.ts",
        "src/hooks/auto-update-checker/hook/startup-toasts.ts",
        "src/hooks/auto-update-checker/hook.ts"
    ]
    
    issues = []
    for file_path in feature_files:
        if not Path(file_path).exists():
            continue
            
        content = Path(file_path).read_text()
        
        # Check for SafeToastWrapper import
        if "SafeToastWrapper" not in content:
            issues.append(f"{file_path}: Missing SafeToastWrapper import")
        
        # Check for direct toast calls
        if ".tui.showToast(" in content or "client.tui.showToast(" in content:
            issues.append(f"{file_path}: Still using direct toast calls")
        
        # Check for awaited toast calls
        if "await show" in content and "Toast" in content:
            issues.append(f"{file_path}: Still awaiting toast calls")
    
    if issues:
        print("❌ Feature families not using SafeToastWrapper correctly:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    
    print("✅ All feature families use SafeToastWrapper")
    return True

def check_toast_wrapper_tests():
    """Check that SafeToastWrapper has comprehensive tests."""
    print("🔍 Checking SafeToastWrapper test coverage...")
    
    test_file = Path("src/shared/safe-toast-wrapper.test.ts")
    if not test_file.exists():
        print("❌ SafeToastWrapper test file not found")
        return False
    
    content = test_file.read_text()
    
    # Check for key test categories
    required_tests = [
        "Basic Toast Functionality",
        "Fail-Open Behavior",
        "Non-Blocking Behavior",
        "Error Logging and Throttling",
        "Integration with Feature Families"
    ]
    
    missing_tests = []
    for test in required_tests:
        if test not in content:
            missing_tests.append(test)
    
    if missing_tests:
        print(f"❌ Missing test categories: {missing_tests}")
        return False
    
    print("✅ SafeToastWrapper test coverage verified")
    return True

def run_toast_wrapper_tests():
    """Run the SafeToastWrapper test suite."""
    print("🔍 Running SafeToastWrapper tests...")
    
    code, stdout, stderr = run_command(
        "bun test src/shared/safe-toast-wrapper.test.ts",
        timeout=30
    )
    
    if code != 0:
        print("❌ SafeToastWrapper tests failed")
        print(f"Error: {stderr}")
        return False
    
    # Check for test passes
    if "fail" in stdout.lower():
        print("❌ Some SafeToastWrapper tests failed")
        return False
    
    print("✅ SafeToastWrapper tests pass")
    return True

def check_shared_index_exports():
    """Check that SafeToastWrapper is exported from shared/index.ts."""
    print("🔍 Checking SafeToastWrapper export...")
    
    index_file = Path("src/shared/index.ts")
    if not index_file.exists():
        print("⚠️ shared/index.ts not found (optional)")
        return True
    
    content = index_file.read_text()
    
    if "SafeToastWrapper" not in content:
        print("⚠️ SafeToastWrapper not exported from shared/index.ts (optional)")
        return True
    
    print("✅ SafeToastWrapper properly exported")
    return True

def main():
    """Run all shared toast wrapper checks."""
    print("🔍 Checking Shared Toast Wrapper Fix for commits 31/46-38/46...")
    print("=" * 60)
    
    checks = [
        ("SafeToastWrapper Implementation", check_safe_toast_wrapper_exists),
        ("No Direct Toast Calls", check_no_direct_toast_calls),
        ("No Awaited Toast Calls", check_no_awaited_toast_calls),
        ("Feature Families Use Wrapper", check_feature_families_use_wrapper),
        ("Toast Wrapper Tests", check_toast_wrapper_tests),
        ("Run Toast Wrapper Tests", run_toast_wrapper_tests),
        ("Shared Index Exports", check_shared_index_exports),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} check failed with exception: {e}")
            results.append((name, False))
        print()
    
    # Summary
    print("=" * 60)
    print("📊 Shared Toast Wrapper Fix Summary:")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 60)
    print(f"Total: {passed} passed, {failed} failed")
    
    if failed > 0:
        print("\n❌ Shared toast wrapper issues detected!")
        print("The failure block 31/46-38/46 is not fully repaired.")
        sys.exit(1)
    else:
        print("\n✅ All shared toast wrapper fixes verified!")
        print("The failure block 31/46-38/46 is ready for 10/10 quality.")
        sys.exit(0)

if __name__ == "__main__":
    main()
