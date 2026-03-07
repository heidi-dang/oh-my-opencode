import os
import re

def patch_file(path, replacements):
    if not os.path.exists(path):
        return
    with open(path, 'r') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"Patched: {path}")

# 1. src/agents/utils.test.ts
# Add missing undefined before disabledSkills
patch_file('src/agents/utils.test.ts', [
    ('undefined, undefined, disabledSkills)', 'undefined, undefined, undefined, disabledSkills)')
])

# 2. src/features/background-agent/manager.test.ts
# TS2741: Property 'variant' is missing
patch_file('src/features/background-agent/manager.test.ts', [
    ('model: "claude-3-5-sonnet-20241022"', 'model: "claude-3-5-sonnet-20241022", variant: "default" as any'),
    ('providers: ["anthropic"], model: "claude-3-5-sonnet-20241022"', 'providers: ["anthropic"], model: "claude-3-5-sonnet-20241022", variant: "default" as any'),
    ('model: "test-model"', 'model: "test-model", variant: "test-variant" as any'),
    ('sessionID: "ses_1"', 'id: "ses_1"')
])

# 3. src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts
# TS2349: This expression is not callable. Type 'never'
# It was revert() -> revert. Let's make it revert() as any
patch_file('src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts', [
    ('revert()', '(revert as any)()')
])

# 4. src/features/tmux-subagent/action-executor.test.ts
# TS2322: paneId missing
patch_file('src/features/tmux-subagent/action-executor.test.ts', [
    ('success: false }', 'success: false, paneId: "" }')
])

# 5. src/plugin/ultrawork-db-model-override.test.ts
patch_file('src/plugin/ultrawork-db-model-override.test.ts', [
    ('bindings: "invalid"', 'bindings: ["invalid"]')
])

# 6. src/tools/background-task/create-background-task.test.ts
patch_file('src/tools/background-task/create-background-task.test.ts', [
    ('await tool.execute(args, TEST_CONTEXT)', 'await tool.execute(args, TEST_CONTEXT as any)')
])

# 7. src/shared/opencode-http-api.test.ts
patch_file('src/shared/opencode-http-api.test.ts', [
    ('spyOn(global, "fetch").mockImplementation(mock(() => Promise.resolve(new Response())) as any)', 
     'spyOn(global, "fetch").mockImplementation(mock(() => Promise.resolve(new Response())) as any) as any')
])

# 8. src/hooks/write-existing-file-guard/index.test.ts
patch_file('src/hooks/write-existing-file-guard/index.test.ts', [
    ('const event = {', 'const event: any = {')
])

