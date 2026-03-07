import re

def insert_as_any(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    for i, line in enumerate(lines):
        # In event.test.ts, we have `await eventHandler({`
        if 'await eventHandler({' in line or 'await eventHandlerWithMock({' in line:
            lines[i] = line.replace('({', '(({')
            
        # find the end of the eventHandler call
        if line.strip() == '})' and ('await eventHandler' in lines[i-5] or 'event:' in lines[i-5] or 'event:' in lines[i-4] or 'event:' in lines[i-3] or 'event:' in lines[i-2] or 'event:' in lines[i-1]):
            # This is too fragile!
            pass

filename = "src/plugin/event.test.ts"
with open(filename, 'r') as f:
    text = f.read()

# Replace all `await eventHandler({ ... })` with `await eventHandler({ ... } as any)`
# We can use regex to match the balanced braces but Python's re doesn't support recursive descent easily.
# Let's just string-replace the exact known lines!

lines = text.split('\n')
for i, line in enumerate(lines):
    if line.startswith('\t\t\tevent: {') and 'type: "message.updated"' in lines[i+1]:
        lines[i] = '\t\t\tevent: { ...({} as any),'
    elif line.startswith('\t\t\tevent: {') and 'type: "session.idle"' in lines[i+1]:
        lines[i] = '\t\t\tevent: { ...({} as any),'
    elif line.startswith('\t\t\tevent: {') and 'type: "session.deleted"' in lines[i+1]:
        lines[i] = '\t\t\tevent: { ...({} as any),'

text = '\n'.join(lines)
text = text.replace('hooks: {', 'hooks: ({')
text = text.replace('atlasHook: { handler: async () => {} },', 'atlasHook: { handler: async () => {} } } as any),')

with open(filename, 'w') as f:
    f.write(text)

inj_file = "src/features/context-injector/injector.test.ts"
with open(inj_file, 'r') as f:
    text = f.read()
text = text.replace('messages: [{', 'messages: [{ ...({} as any),')
with open(inj_file, 'w') as f:
    f.write(text)

