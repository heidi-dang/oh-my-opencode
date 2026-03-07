import re
import os

with open('tsc.log') as f:
    log = f.read()

files_changed = set()

# Strategy 1: Fix TS2451 by replacing bunTest = require
for file in set(re.findall(r'([a-zA-Z0-9_/-]+\.test\.ts)\([0-9]+,[0-9]+\): error TS2451', log)):
    if not os.path.exists(file): continue
    with open(file, 'r') as f: content = f.read()
    content = content.replace('const bunTest = require("bun:test")', 'import * as bunTest from "bun:test"')
    with open(file, 'w') as f: f.write(content)
    files_changed.add(file)

# Strategy 2: Fix ToolContext missing properties
# error [...] is missing the following properties from type 'ToolContext': directory, worktree, metadata, ask
for file in set(re.findall(r'([a-zA-Z0-9_/-]+\.test\.ts)\(.*missing the following properties from type \'ToolContext\'', log)):
    if not os.path.exists(file): continue
    with open(file, 'r') as f: content = f.read()
    # Find tool context declarations and add properties if missing
    def repl_tool_ctx(m):
        block = m.group(1)
        if 'directory:' not in block: block += '\n      directory: "/tmp",'
        if 'worktree:' not in block: block += '\n      worktree: "",'
        if 'metadata:' not in block: block += '\n      metadata: () => {},'
        if 'ask:' not in block: block += '\n      ask: async () => {},'
        return 'const toolContext = {' + block + '\n    }'
    
    content = re.sub(r'const toolContext\s*=\s*\{([\s\S]*?)\n\s*\}', repl_tool_ctx, content)
    
    # Also fix inline TEST_CONTEXT or similar if they lack directory
    def repl_inline(m):
        block = m.group(1)
        if 'sessionID:' in block and 'directory:' not in block:
            return m.group(0).replace('sessionID:', 'directory: "/tmp", worktree: "", metadata: () => {}, ask: async () => {}, sessionID:')
        return m.group(0)
    
    content = re.sub(r'\{([^{}]*sessionID:[^{}]*)\}', repl_inline, content)
    
    with open(file, 'w') as f: f.write(content)
    files_changed.add(file)

# Strategy 3: Fix PluginInput missing properties
for file in set(re.findall(r'([a-zA-Z0-9_/-]+\.test\.ts)\(.*missing the following properties from type \'PluginInput\'', log)):
    if not os.path.exists(file): continue
    with open(file, 'r') as f: content = f.read()
    # Add project, worktree, serverUrl, $
    def repl_plugin_ctx(m):
        block = m.group(1)
        if 'project:' not in block: block += '\n      project: {},'
        if 'worktree:' not in block: block += '\n      worktree: "",'
        if 'serverUrl:' not in block: block += '\n      serverUrl: "",'
        if '$:' not in block: block += '\n      $: () => {},'
        return 'const ctx = {' + block + '\n    }'
    content = re.sub(r'const ctx\s*=\s*\{([\s\S]*?)\n\s*\}', repl_plugin_ctx, content)
    
    with open(file, 'w') as f: f.write(content)
    files_changed.add(file)

print(f"Fixed {len(files_changed)} files")
