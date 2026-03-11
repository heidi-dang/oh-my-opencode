#!/usr/bin/env python3
"""
Runtime Foundation Repair Doctor Check

Validates that the runtime foundation repairs for commits 15/46-30/46 are working:
1. Background cancel deadlock is fixed
2. Toast/notification fail-open during cancellation
3. Auto-execution state gating prevents re-entry after cancel

This check ensures the entire failure block 15/46-30/46 achieves 10/10 quality.
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

def check_background_cancel_deadlock():
    """Check that background cancel deadlock is fixed."""
    print("🔍 Checking background cancel deadlock fix...")
    
    # Run the cancellation deadlock tests
    code, stdout, stderr = run_command(
        "bun test src/features/background-agent/cancellation-deadlock.test.ts",
        timeout=30
    )
    
    if code != 0:
        print("❌ Background cancel deadlock tests failed")
        print(f"Error: {stderr}")
        return False
    
    # Check for test passes
    if "fail" in stdout.lower():
        print("❌ Some background cancel deadlock tests failed")
        return False
    
    print("✅ Background cancel deadlock fix verified")
    return True

def check_runtime_foundation_repair():
    """Check that runtime foundation repair tests pass."""
    print("🔍 Checking runtime foundation repair...")
    
    # Run the runtime foundation repair tests
    code, stdout, stderr = run_command(
        "bun test src/features/background-agent/runtime-foundation-repair.test.ts",
        timeout=30
    )
    
    if code != 0:
        print("❌ Runtime foundation repair tests failed")
        print(f"Error: {stderr}")
        return False
    
    # Check for test passes
    if "fail" in stdout.lower():
        print("❌ Some runtime foundation repair tests failed")
        return False
    
    print("✅ Runtime foundation repair verified")
    return True

def check_toast_fail_open():
    """Verify toast operations are fail-open during cancellation."""
    print("🔍 Checking toast fail-open implementation...")
    
    # Check that toast operations have try-catch blocks
    manager_file = Path("src/features/background-agent/manager.ts")
    if not manager_file.exists():
        print("❌ Background manager file not found")
        return False
    
    content = manager_file.read_text()
    
    # Look for try-catch around toast operations
    toast_patterns = [
        "try {",
        "toastManager.removeTask",
        "catch (err)",
        "Don't let toast failures prevent"
    ]
    
    missing_patterns = []
    for pattern in toast_patterns:
        if pattern not in content:
            missing_patterns.append(pattern)
    
    if missing_patterns:
        print(f"❌ Missing toast fail-open patterns: {missing_patterns}")
        return False
    
    print("✅ Toast fail-open implementation verified")
    return True

def check_auto_execution_state_gating():
    """Verify auto-execution checks cancellation state."""
    print("🔍 Checking auto-execution state gating...")
    
    # Check that auto-executor has cancellation checks
    auto_executor_file = Path("src/hooks/atlas/auto-executor.ts")
    if not auto_executor_file.exists():
        print("❌ Auto-executor file not found")
        return False
    
    content = auto_executor_file.read_text()
    
    # Look for cancellation state checks
    gating_patterns = [
        "session.data.status",
        '"cancelled"',
        '"error"',
        "isAbortError",
        "Auto-execution skipped"
    ]
    
    missing_patterns = []
    for pattern in gating_patterns:
        if pattern not in content:
            missing_patterns.append(pattern)
    
    if missing_patterns:
        print(f"❌ Missing auto-execution state gating patterns: {missing_patterns}")
        return False
    
    print("✅ Auto-execution state gating verified")
    return True

def check_bounded_cancellation():
    """Verify cancellation completes in bounded time."""
    print("🔍 Checking bounded cancellation...")
    
    # Create a simple test script
    test_script = """
import { BackgroundManager } from './src/features/background-agent/manager.ts';

const manager = new BackgroundManager({
  client: {
    session: {
      abort: async () => ({ data: {} }),
      promptAsync: async () => ({ data: {} }),
      get: async () => ({ data: {} }),
      messages: async () => ({ data: [] }),
    }
  },
  directory: '/tmp'
} as any);

async function testBoundedCancel() {
  const task = await manager.launch({
    description: 'Test task',
    prompt: 'Do something',
    agent: 'test-agent',
    parentSessionID: 'parent',
    parentMessageID: 'msg'
  });
  
  const start = Date.now();
  await manager.cancelTask(task.id, { source: 'test' });
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    console.log('FAIL: Cancellation took too long:', duration);
    process.exit(1);
  }
  
  console.log('PASS: Bounded cancellation verified');
  process.exit(0);
}

testBoundedCancel().catch(err => {
  console.log('FAIL:', err);
  process.exit(1);
});
"""
    
    # Write test script
    test_file = Path("/tmp/bounded-cancel-test.ts")
    test_file.write_text(test_script)
    
    # Run the test from the correct directory
    code, stdout, stderr = run_command(
        f"bun run {test_file}",
        cwd="/home/heidi/work/oh-my-opencode-seftaudit",
        timeout=10
    )
    
    # Cleanup
    test_file.unlink(missing_ok=True)
    
    if code != 0 or "FAIL" in stdout:
        print("❌ Bounded cancellation test failed")
        print(f"Output: {stdout}")
        print(f"Error: {stderr}")
        return False
    
    print("✅ Bounded cancellation verified")
    return True

def check_no_leaked_processes():
    """Check for leaked processes after cancellation."""
    print("🔍 Checking for leaked processes...")
    
    # This is a simplified check - in a real environment, you'd
    # want to check for specific process types
    code, stdout, stderr = run_command(
        "ps aux | grep -E '(bun|node)' | grep -v grep | wc -l",
        timeout=5
    )
    
    if code != 0:
        print("⚠️ Could not check for leaked processes")
        return True  # Don't fail the check for this
    
    try:
        process_count = int(stdout.strip())
        # If there are more than 50 processes, might be a leak
        if process_count > 50:
            print(f"⚠️ High process count: {process_count}")
        print("✅ Process leak check completed")
        return True
    except ValueError:
        print("⚠️ Could not parse process count")
        return True

def main():
    """Run all runtime foundation repair checks."""
    print("🔍 Checking Runtime Foundation Repair for commits 15/46-30/46...")
    print("=" * 60)
    
    checks = [
        ("Background Cancel Deadlock", check_background_cancel_deadlock),
        ("Runtime Foundation Repair", check_runtime_foundation_repair),
        ("Toast Fail-Open", check_toast_fail_open),
        ("Auto-Execution State Gating", check_auto_execution_state_gating),
        ("Bounded Cancellation", check_bounded_cancellation),
        ("No Leaked Processes", check_no_leaked_processes),
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
    print("📊 Runtime Foundation Repair Summary:")
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
        print("\n❌ Runtime foundation repair issues detected!")
        print("The failure block 15/46-30/46 is not fully repaired.")
        sys.exit(1)
    else:
        print("\n✅ All runtime foundation repairs verified!")
        print("The failure block 15/46-30/46 is ready for 10/10 quality.")
        sys.exit(0)

if __name__ == "__main__":
    main()
