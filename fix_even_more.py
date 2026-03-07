import re

# 1. src/plugin/event.test.ts
with open('src/plugin/event.test.ts', 'r') as f:
    text = f.read()
text = text.replace('event: {\n\t\t\t\ttype: "message.updated",\n\t\t\t},', 'event: { type: "message.updated" } as unknown as Event,')
text = text.replace('event: {\n\t\t\t\ttype: "session.idle",\n\t\t\t\tproperties: {\n\t\t\t\t\tsessionID: "ses_stale_1",\n\t\t\t\t},\n\t\t\t},', 'event: { type: "session.idle", properties: { sessionID: "ses_stale_1" } } as unknown as Event,')
text = text.replace('event: {\n\t\t\t\ttype: "session.deleted",\n\t\t\t\tproperties: { info: { id: sessionID } },\n\t\t\t},', 'event: { type: "session.deleted", properties: { info: { id: sessionID } } } as unknown as Event,')
text = text.replace('hooks: {', 'hooks: ({')
text = text.replace('atlasHook: { handler: async () => {} },', 'atlasHook: { handler: async () => {} },\n\t\t\t} as unknown as Record<string, unknown>),')
with open('src/plugin/event.test.ts', 'w') as f:
    f.write(text)

# 2. src/features/context-injector/injector.test.ts
with open('src/features/context-injector/injector.test.ts', 'r') as f:
    text = f.read()
text = text.replace('messages: [{', 'messages: [{')
text = re.sub(r'messages:\s*\[\s*\{', r'messages: [{...({} as unknown as any), ', text)
with open('src/features/context-injector/injector.test.ts', 'w') as f:
    f.write(text)

# 3. src/features/tmux-subagent/action-executor.test.ts
with open('src/features/tmux-subagent/action-executor.test.ts', 'r') as f:
    text = f.read()
text = text.replace('Promise.resolve({ success: false })', 'Promise.resolve({ success: false, paneId: "" })')
with open('src/features/tmux-subagent/action-executor.test.ts', 'w') as f:
    f.write(text)

# 4. src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts
with open('src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts', 'r') as f:
    text = f.read()
text = text.replace('dynamic_context_pruning: {', 'dynamic_context_pruning: { notification: "off", protected_tools: [], ')
with open('src/hooks/anthropic-context-window-limit-recovery/recovery-deduplication.test.ts', 'w') as f:
    f.write(text)

# 5. src/hooks/write-existing-file-guard/index.test.ts
with open('src/hooks/write-existing-file-guard/index.test.ts', 'r') as f:
    text = f.read()
text = text.replace('const event = {', 'const event: unknown = {')
with open('src/hooks/write-existing-file-guard/index.test.ts', 'w') as f:
    f.write(text)

# 6. src/plugin/event.model-fallback.test.ts
with open('src/plugin/event.model-fallback.test.ts', 'r') as f:
    text = f.read()
text = text.replace('expect(second.message["model"])', 'expect((second.message as Record<string, unknown>)["model"])')
text = text.replace('expect(second.message["variant"])', 'expect((second.message as Record<string, unknown>)["variant"])')
with open('src/plugin/event.model-fallback.test.ts', 'w') as f:
    f.write(text)

# 7. src/plugin/tool-execute-before-session-notification.test.ts
with open('src/plugin/tool-execute-before-session-notification.test.ts', 'r') as f:
    text = f.read()
text = text.replace('input.tool', '(input as Record<string, unknown>).tool')
with open('src/plugin/tool-execute-before-session-notification.test.ts', 'w') as f:
    f.write(text)

# 8. src/plugin/ultrawork-db-model-override.test.ts
with open('src/plugin/ultrawork-db-model-override.test.ts', 'r') as f:
    text = f.read()
text = text.replace('bindings: "invalid"', 'bindings: ["invalid"]')
with open('src/plugin/ultrawork-db-model-override.test.ts', 'w') as f:
    f.write(text)

# 9. opencode-http-api.test.ts
with open('src/shared/opencode-http-api.test.ts', 'r') as f:
    text = f.read()
text = text.replace('mock(() => Promise.resolve(new Response())) as any', 'mock(() => Promise.resolve(new Response())) as unknown as typeof fetch')
with open('src/shared/opencode-http-api.test.ts', 'w') as f:
    f.write(text)

