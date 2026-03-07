import re

with open('src/plugin/event.test.ts', 'r') as f:
    text = f.read()

# Replace all occurrences of `atlasHook... } as any),\n\t+},`
# with `atlasHook... },\n\t+} as any),`

text = re.sub(
    r'atlasHook:\s*\{\s*handler:\s*async\s*\(\)\s*=>\s*\{\}\s*\}\s*\}\s*as\s*any\),\s*\n(\s*)\},',
    r'atlasHook: { handler: async () => {} },\n\1} as any),',
    text
)

# And if there are any trailing `}) as any)` that were applied, we should check `tsc` again
# But let's write it out first.

with open('src/plugin/event.test.ts', 'w') as f:
    f.write(text)

