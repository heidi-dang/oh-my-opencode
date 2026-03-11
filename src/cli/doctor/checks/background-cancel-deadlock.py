#!/usr/bin/env python3
"""
Doctor check for background cancel deadlock issue.
Ensures that cancellation is non-blocking and doesn't cause deadlocks.
"""

import subprocess
import time
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

def check_background_cancel_deadlock() -> Dict[str, Any]:
    """Check for background cancel deadlock issues."""
    results = {
        "name": "Background Cancel Deadlock Check",
        "status": "pass",
        "issues": [],
        "details": {}
    }
    
    try:
        # Check if the deadlock fix tests exist and pass
        test_file = Path("src/features/background-agent/cancellation-deadlock.test.ts")
        if not test_file.exists():
            results["status"] = "fail"
            results["issues"].append("Cancellation deadlock test file missing")
            return results
        
        # Run the deadlock tests
        test_result = subprocess.run(
            ["bun", "test", str(test_file), "--reporter=json"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if test_result.returncode != 0:
            results["status"] = "fail"
            results["issues"].append("Cancellation deadlock tests failed")
            results["details"]["test_output"] = test_result.stdout
            results["details"]["test_errors"] = test_result.stderr
            return results
        
        # Parse test results
        try:
            test_data = json.loads(test_result.stdout)
            passed_tests = sum(1 for test in test_data if test.get("status") == "pass")
            total_tests = len(test_data)
            
            results["details"]["tests_passed"] = passed_tests
            results["details"]["tests_total"] = total_tests
            
            if passed_tests != total_tests:
                results["status"] = "fail"
                results["issues"].append(f"Not all deadlock tests passed: {passed_tests}/{total_tests}")
                
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            if "pass" not in test_result.stdout:
                results["status"] = "fail"
                results["issues"].append("Tests may not be passing")
        
        # Check for fire-and-forget notification pattern in the code
        manager_file = Path("src/features/background-agent/manager.ts")
        if manager_file.exists():
            content = manager_file.read_text()
            
            # Check if the deadlock fix is present
            if "void this.enqueueNotificationForParent" in content:
                results["details"]["fire_and_forget_pattern"] = "present"
            else:
                results["status"] = "warn"
                results["issues"].append("Fire-and-forget notification pattern not found")
                results["details"]["fire_and_forget_pattern"] = "missing"
            
            # Check for await before notification (deadlock pattern)
            if "await this.enqueueNotificationForParent" in content:
                results["status"] = "fail"
                results["issues"].append("Found blocking notification pattern that could cause deadlock")
                results["details"]["blocking_notification_found"] = True
        
        # Check for proper timeout handling in cancellation
        if manager_file.exists():
            content = manager_file.read_text()
            
            # Look for cancellation methods that don't have proper timeout handling
            if "async cancelTask" in content and "timeout" not in content.lower():
                results["details"]["cancellation_timeout"] = "not_implemented"
            else:
                results["details"]["cancellation_timeout"] = "implemented"
    
    except subprocess.TimeoutExpired:
        results["status"] = "fail"
        results["issues"].append("Tests timed out - possible deadlock detected")
    except Exception as e:
        results["status"] = "error"
        results["issues"].append(f"Unexpected error: {str(e)}")
    
    return results

def check_background_process_leaks() -> Dict[str, Any]:
    """Check for leaked background processes after cancellation."""
    results = {
        "name": "Background Process Leak Check",
        "status": "pass",
        "issues": [],
        "details": {}
    }
    
    try:
        # Check for any hanging node/bun processes
        result = subprocess.run(
            ["pgrep", "-f", "bun.*test.*background-agent"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            # Found hanging processes
            pids = result.stdout.strip().split('\n')
            results["status"] = "warn"
            results["issues"].append(f"Found {len(pids)} potentially hanging test processes")
            results["details"]["hanging_pids"] = pids
            
            # Try to clean them up
            for pid in pids:
                try:
                    subprocess.run(["kill", "-9", pid], capture_output=True)
                except:
                    pass
    
    except Exception as e:
        # pgrep might not be available, skip this check
        results["status"] = "skip"
        results["issues"].append(f"Could not check for process leaks: {str(e)}")
    
    return results

def main():
    """Run all background cancel deadlock checks."""
    print("🔍 Checking for background cancel deadlock issues...")
    
    checks = [
        check_background_cancel_deadlock,
        check_background_process_leaks
    ]
    
    all_passed = True
    for check_func in checks:
        result = check_func()
        
        status_icon = {
            "pass": "✅",
            "fail": "❌", 
            "warn": "⚠️",
            "error": "💥",
            "skip": "⏭️"
        }.get(result["status"], "❓")
        
        print(f"\n{status_icon} {result['name']}")
        
        if result["issues"]:
            for issue in result["issues"]:
                print(f"   • {issue}")
        
        if result["details"]:
            for key, value in result["details"].items():
                if key not in ["test_output", "test_errors"]:
                    print(f"   • {key}: {value}")
        
        if result["status"] == "fail":
            all_passed = False
    
    if all_passed:
        print("\n✅ All background cancel deadlock checks passed!")
        sys.exit(0)
    else:
        print("\n❌ Some background cancel deadlock checks failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
