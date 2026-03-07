import re
import os

files = [
    "src/plugin/event.test.ts"
]

for file in files:
    if not os.path.exists(file): continue
    with open(file, 'r') as f: content = f.read()
    
    # Cast the entire hooks object to any to bypass strict checks
    content = content.replace('hooks: { ...({} as any),', 'hooks: ({')
    content = content.replace('atlasHook: { ...({} as any), handler: async () => {} },', 'atlasHook: { handler: async () => {} } } as any),')
    
    # Wait, simple regex won't balance braces. Let's just sed the whole file
    
    with open(file, 'w') as f: f.write(content)

import subprocess
subprocess.run(['sed', '-i', 's/hooks: {/hooks: ({/g', 'src/plugin/event.test.ts'])
subprocess.run(['sed', '-i', 's/atlasHook: { handler: async () => {} },/atlasHook: { handler: async () => {} },\n\t\t\t} as any),/g', 'src/plugin/event.test.ts'])

subprocess.run(['sed', '-i', 's/backgroundNotificationHook/backgroundNotificationHook/g', 'src/plugin/event.test.ts']) # dummy

# Fix spyOn in opencode-http-api.test.ts
with open('src/shared/opencode-http-api.test.ts', 'r') as f:
    text = f.read()
if "import" not in text:
    text = 'import { describe, expect, it, mock, spyOn } from "bun:test"\n' + text
with open('src/shared/opencode-http-api.test.ts', 'w') as f:
    f.write(text)

# Also fix the background-task ToolContext
subprocess.run(['sed', '-i', 's/toolContext/toolContext as any/g', 'src/tools/background-task/create-background-task.test.ts'])

