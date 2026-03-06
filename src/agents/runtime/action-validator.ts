import { z } from "zod";

/**
 * AgentAction Validator
 * 
 * Enforces a strict schema for all LLM outputs.
 * Non-compliant text or malformed JSON is rejected immediately.
 */

export const AgentActionSchema = z.union([
    z.object({
        type: z.literal("tool"),
        tool: z.string().min(1, "Tool name is required"),
        args: z.record(z.string(), z.any())
    }),
    z.object({
        type: z.literal("delegate"),
        agent: z.string().min(1, "Agent name is required"),
        task: z.string().min(1, "Task description is required")
    }),
    z.object({
        type: z.literal("report"),
        message: z.string().min(1, "Report message is required")
    })
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;

export const ActionValidator = {
    /**
     * Validates a raw agent JSON response against the schema.
     * Throws an error if invalid.
     */
    validate: (rawAction: any): AgentAction => {
        const result = AgentActionSchema.safeParse(rawAction);
        if (!result.success) {
            const errorDetails = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`[Action Validator] Invalid Agent Action. Schema mismatch: ${errorDetails}`);
        }
        return result.data as AgentAction;
    },


    /**
     * Helper to parse and validate a message string.
     */
    parseAndValidate: (text: string): AgentAction => {
        try {
            const json = JSON.parse(text);
            return ActionValidator.validate(json);
        } catch (e: any) {
            if (e.name === 'SyntaxError') {
                throw new Error(`[Action Validator] Failed to parse agent response as JSON. Received: ${text.slice(0, 100)}...`);
            }
            throw e;
        }
    }
};
