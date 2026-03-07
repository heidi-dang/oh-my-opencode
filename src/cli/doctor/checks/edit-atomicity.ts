import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs"
import { join } from "path"
import type { CheckDefinition, CheckResult } from "../types"
import { createEditSafeguardHook } from "../../../hooks/edit-safeguard/hook"

/**
 * Doctor check for Edit tool atomicity and syntax validation.
 */
export const checkEditAtomicity: CheckDefinition = {
  id: "EDIT_ATOMICITY",
  name: "Edit Atomicity & Validation",
  async check(): Promise<CheckResult> {
    const testFile = join(process.cwd(), "test_edit_atomicity.py")
    const originalContent = 'def main():\n    print("hello")\n'
    
    try {
      writeFileSync(testFile, originalContent)
      
      const hook = createEditSafeguardHook({ directory: process.cwd() } as any)
      const sessionID = "test-session"
      const callID = "test-call"

      // 1. Verify Fail-Closed for Partial Mutation (Simulated)
      // We simulate a tool that changes the file but then reports an error
      await hook["tool.execute.before"]?.({ tool: "edit", sessionID, callID }, { args: { filePath: testFile } })
      
      // Simulate partial mutation
      writeFileSync(testFile, 'def main():\n    print("corrupted"\n') // Syntax error + change
      
      // Simulate tool output reporting failure
      const output = { 
        title: "Edit", 
        output: "Error: oldString not found", 
        metadata: { args: { filePath: testFile } } 
      }
      
      await hook["tool.execute.after"]?.({ tool: "edit", sessionID, callID, args: { filePath: testFile } }, output)
      
      const contentAfterFail = readFileSync(testFile, "utf-8")
      if (contentAfterFail !== originalContent) {
        return {
          status: "fail",
          name: this.name,
          message: "Edit is NOT atomic. Partial mutation was not reverted after error.",
          issues: [{
            title: "Partial Mutation",
            description: "File content changed despite tool reporting failure.",
            severity: "error"
          }],
        }
      }

      // 2. Verify Syntax Validation
      await hook["tool.execute.before"]?.({ tool: "edit", sessionID, callID: "call2" }, { args: { filePath: testFile } })
      
      // Change to invalid syntax
      writeFileSync(testFile, 'def main():\n    print("invalid")\n    x = [') 
      
      const outputSuccess = { 
        title: "Edit", 
        output: "Successfully replaced string", 
        metadata: { args: { filePath: testFile } } 
      }

      try {
        await hook["tool.execute.after"]?.({ tool: "edit", sessionID, callID: "call2", args: { filePath: testFile } }, outputSuccess)
        return {
          status: "fail",
          name: this.name,
          message: "Syntax validation failed to block invalid Python code.",
          issues: [{
            title: "Validation Bypass",
            description: "Edit tool allowed syntactically invalid Python code.",
            severity: "error"
          }],
        }
      } catch (err) {
        // Expected throw
        if (!String(err).includes("Syntax validation failed")) {
             return {
                status: "fail",
                name: this.name,
                message: `Unexpected error during syntax validation: ${err}`,
                issues: [{
                    title: "Unexpected Error",
                    description: String(err),
                    severity: "error"
                }],
            }
        }
      }

      const contentAfterSyntaxFail = readFileSync(testFile, "utf-8")
      if (contentAfterSyntaxFail !== originalContent) {
        return {
          status: "fail",
          name: this.name,
          message: "File was not reverted after syntax validation failure.",
          issues: [{
            title: "Revert Failed",
            description: "File was not restored to its original state after syntax error.",
            severity: "error"
          }],
        }
      }

      return {
        status: "pass",
        name: this.name,
        message: "Edit atomicity and syntax validation are working correctly.",
        issues: [],
      }

    } catch (err) {
      return {
        status: "fail",
        name: this.name,
        message: `Check failed with error: ${err}`,
        issues: [{
            title: "Check Error",
            description: String(err),
            severity: "error"
        }],
      }
    } finally {
      if (existsSync(testFile)) unlinkSync(testFile)
    }
  },
}
