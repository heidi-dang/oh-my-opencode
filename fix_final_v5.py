import os

def patch_line(path, lnum, old, new):
    if not os.path.exists(path): return
    with open(path, 'r') as f:
        lines = f.readlines()
    if lnum >= len(lines): return
    if old in lines[lnum]:
        lines[lnum] = lines[lnum].replace(old, new)
        with open(path, 'w') as f:
            f.writelines(lines)
        print(f"Patched line {lnum+1}: {path}")

# 1. recovery-deduplication.test.ts:89
patch_line('src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts', 88, 'resolveSummarize()', '(resolveSummarize as any)()')

# 2. action-executor.test.ts:93
patch_line('src/features/tmux-subagent/action-executor.test.ts', 92, 'success: false }', 'success: false, paneId: "" }')

# 3. ultrawork-db-model-override.test.ts:63
patch_line('src/plugin/ultrawork-db-model-override.test.ts', 62, 'bindings: "invalid"', 'bindings: ["invalid"]')

# 4. background-task/create-background-task.test.ts:62
patch_line('src/tools/background-task/create-background-task.test.ts', 61, 'TEST_CONTEXT)', 'TEST_CONTEXT as any)')

# 5. auto-update-checker/hook/background-update-check.test.ts:34
patch_line('src/hooks/auto-update-checker/hook/background-update-check.test.ts', 33, '() => {}', '(() => false) as any')

# 6. rules-injector/injector.test.ts:41, 48
patch_line('src/hooks/rules-injector/injector.test.ts', 40, 'as NonSharedBuffer', 'as any')
patch_line('src/hooks/rules-injector/injector.test.ts', 47, 'fs.Stats', 'any')

# 7. semantic-loop-guard/hook.test.ts:64
patch_line('src/hooks/semantic-loop-guard/hook.test.ts', 63, 'before"]()', 'before"]({} as any, {} as any)')

# 8. write-existing-file-guard/index.test.ts:59
patch_line('src/hooks/write-existing-file-guard/index.test.ts', 58, 'const event = {', 'const event: any = {')

# 9. tool-execute-before-session-notification.test.ts:14
patch_line('src/plugin/tool-execute-before-session-notification.test.ts', 13, 'input.tool', '(input as any).tool')

# 10. opencode-http-api.test.ts:6
patch_line('src/shared/opencode-http-api.test.ts', 5, 'as any)', 'as any) as any')

# 11. model-fallback.test.ts: 326, 330, 336, 340
patch_line('src/plugin/event.model-fallback.test.ts', 325, 'second.message["model"]', '(second.message as any)["model"]')
patch_line('src/plugin/event.model-fallback.test.ts', 329, 'second.message["variant"]', '(second.message as any)["variant"]')
patch_line('src/plugin/event.model-fallback.test.ts', 335, 'second.message["model"]', '(second.message as any)["model"]')
patch_line('src/plugin/event.model-fallback.test.ts', 339, 'second.message["variant"]', '(second.message as any)["variant"]')

# 12. dynamic-agent-prompt-builder.test.ts imports
with open('src/agents/dynamic-agent-prompt-builder.test.ts', 'r') as f:
    orig = f.read()
new = orig.replace('type AvailableSkill,\n  type AvailableCategory,\n  type AvailableAgent,\n} from "./prompts";', '} from "./prompts";\nimport type { AvailableSkill, AvailableCategory, AvailableAgent } from "./types";')
if new != orig:
    with open('src/agents/dynamic-agent-prompt-builder.test.ts', 'w') as f:
        f.write(new)
    print("Patched: src/agents/dynamic-agent-prompt-builder.test.ts")

