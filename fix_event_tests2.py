import re
import os

with open('src/plugin/event.test.ts', 'r') as f:
    content = f.read()

# Fix event.test.ts TS2322 by casting eventHandler parameters to any
content = re.sub(r'(eventHandler(?:WithMock)?\()(\{\s*event:)', r'\1\2', content) # Wait, it's easier to append
# Replace `eventHandler({` with `eventHandler(({` and `})` with `}) as any)` 
# but that's risky. Let's just cast the `event` key.
content = re.sub(r'event:\s*\{\s*type:\s*"([^"]+)"\s*,?\s*\}', r'event: { type: "\1" } as any', content)
content = re.sub(r'event:\s*\{\s*type:\s*"session.deleted",\s*properties:\s*\{\s*info:\s*\{\s*id:\s*([^\}]+)\s*\}\s*,\s*\}\s*,\s*\}', r'event: { type: "session.deleted", properties: { info: { id: \1 } } } as any', content)

# Fix event.test.ts TS2739 inside `hooks: {` block
content = content.replace('hooks: {', 'hooks: ({')
content = content.replace('atlasHook: { handler: async () => {} },', 'atlasHook: { handler: async () => {} },\n\t\t\t} as any),')

with open('src/plugin/event.test.ts', 'w') as f:
    f.write(content)

with open('src/features/context-injector/injector.test.ts', 'r') as f:
    inj = f.read()
inj = inj.replace('await injector.run({', 'await injector.run(({')
inj = inj.replace('}]', '}]')
inj = inj.replace('})', '}) as any)')
with open('src/features/context-injector/injector.test.ts', 'w') as f:
    f.write(inj)

