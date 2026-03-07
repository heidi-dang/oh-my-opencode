import picocolors from "picocolors"
import { CheckDefinition, CheckResult, DoctorIssue } from "../types"
import { getToolFromRegistry } from "../../../runtime/tools/registry"

const CRITICAL_TOOLS = ["complete_task", "fs_safe", "verify_action", "git_safe", "report_issue_verification"]

export const checkToolMetadataContract: CheckDefinition = {
    id: "tool-metadata-contract",
    name: "Tool Metadata Contract",
    critical: true,
    check: async (): Promise<CheckResult> => {
        const issues: DoctorIssue[] = []
        let hasError = false

        // Mock context to prevent actual side effects or throws
        const mockContext = {
            sessionID: "doctor-test",
            callID: "call-test",
            metadata: (meta: any) => {
                if (typeof meta.success !== 'boolean' || typeof meta.verified !== 'boolean') {
                    hasError = true
                    issues.push({
                        severity: "error",
                        title: "Malformed Metadata",
                        description: `Tool did not return boolean 'success' and 'verified' fields in context.metadata(). Found: ${JSON.stringify(meta)}`,
                        fix: "Wrap the tool with withToolContract."
                    })
                }
            }
        }

        for (const toolName of CRITICAL_TOOLS) {
            try {
                const toolSpec = getToolFromRegistry(toolName)
                if (!toolSpec) {
                    issues.push({
                        severity: "warning",
                        title: "Unregistered Tool",
                        description: `Critical tool '${toolName}' is not registered.`,
                        fix: "Check src/runtime/tools/registry.ts."
                    })
                    continue
                }

                // Execute with deliberate invalid arguments to trigger error paths
                await toolSpec.execute({ invalid_arg: "should_fail" }, mockContext)

                // If exception matches our tool wrapper fallback, the context.metadata() 
                // block above will catch contract violations.
            } catch (err: any) {
                // If it entirely fails to catch and bubble up properly, it's a structural error
                 issues.push({
                    severity: "error",
                    title: "Unhandled Tool Exception",
                    description: `Tool '${toolName}' threw an unhandled exception instead of returning a safe failure result. Error: ${err.message}`,
                    fix: "Wrap the tool's execute block with withToolContract to ensure safe fallbacks."
                })
                hasError = true
            }
        }

        if (hasError) {
            return {
                name: "Tool Metadata Contract",
                status: "fail",
                message: picocolors.red("Critical tools are violating the metadata contract on error paths."),
                issues
            }
        }

        return {
            name: "Tool Metadata Contract",
            status: "pass",
            message: picocolors.green("All critical tools conform to the structured metadata contract."),
            issues
        }
    }
}
