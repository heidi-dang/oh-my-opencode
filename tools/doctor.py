import subprocess
import sys
import os

def run_reliability_doctor():
    print("Running Reliability Doctor...")
    result = subprocess.run(["python3", "tools/doctor_runtime_reliability.py"])
    return result.returncode == 0

def main():
    print("Starting OhMyOpencode Doctor Execution...")
    
    # Run core reliability checks
    reliability_pass = run_reliability_doctor()
    
    if not reliability_pass:
        print("\nERROR: Reliability checks failed. System integrity compromised.")
        sys.exit(1)
        
    print("\nSUCCESS: All doctor checks passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
