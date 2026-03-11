import { log } from "../../shared/logger";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface HealingState {
    sessionID: string;
    suspendedAt: number;
    reason: string;
    originalPrompt: string;
}

export class SelfHealingManager {
    private healingRegistry = new Map<string, HealingState>();
    private readonly safeRoomDir = "/tmp/heidi-safe-room";

    async suspendTask(sessionID: string, reason: string, originalPrompt: string) {
        log(`[SelfHealingManager] Suspending session ${sessionID}. Reason: ${reason}`);
        
        const state: HealingState = {
            sessionID,
            suspendedAt: Date.now(),
            reason,
            originalPrompt
        };

        this.healingRegistry.set(sessionID, state);

        try {
            await mkdir(this.safeRoomDir, { recursive: true });
            await writeFile(
                join(this.safeRoomDir, `${sessionID}.json`), 
                JSON.stringify(state, null, 2)
            );
        } catch (error) {
            log(`[SelfHealingManager] Failed to persist suspension state`, { error });
        }

        // Logic to notify TUI about suspension would go here
    }

    async initiateHealing(sessionID: string) {
        log(`[SelfHealingManager] Starting autonomous repair flow for session ${sessionID}...`);
        // Logic to spawn Heidi-Guardian subagent would go here
    }

    async resumeTask(sessionID: string) {
        const state = this.healingRegistry.get(sessionID);
        if (!state) {
            log(`[SelfHealingManager] No suspended state found for ${sessionID}`);
            return;
        }

        log(`[SelfHealingManager] Resuming session ${sessionID}. Recovering from: ${state.reason}`);
        // Logic to re-inject last turn and retry would go here
        this.healingRegistry.delete(sessionID);
    }
}

export const selfHealingManager = new SelfHealingManager();
