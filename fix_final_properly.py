import re
import os

with open("tsc_very_final2.log") as f:
    log = f.read()

for line in log.splitlines():
    match = re.search(r'([a-zA-Z0-9_\-\./]+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+)', line)
    if not match: continue
    file, lnum, cnum, code = match.groups()
    lnum = int(lnum) - 1
    
    if not os.path.exists(file): continue
    with open(file, 'r') as f:
        lines = f.readlines()
        
    line_content = lines[lnum]
    
    # 2349 never call signatures
    if code == "TS2349" and "recovery-deduplication" in file:
        lines[lnum] = line_content.replace('revert()', 'revert')
    # 2352 PluginInput
    elif code == "TS2352" and "PluginInput" in line_content:
        # It says "Conversion of type '{...}' to type 'PluginInput' may be a mistake". We can use "as unknown as PluginInput"
        lines[lnum] = line_content.replace('as PluginInput', 'as unknown as PluginInput')
    elif code == "TS2352" and "Timeout" in line:
        lines[lnum] = line_content.replace('as Timeout', 'as unknown as Timeout')
    elif code == "TS2345" and "background-update-check" in file:
        lines[lnum] = line_content.replace('() => {}', '() => false')
    elif code == "TS2322" and "claude-code-hooks/stop.test.ts" in file:
        lines[lnum] = line_content.replace('Promise.resolve({ exitCode: 0, stdout: "", stderr: "" })', 'Promise.resolve("")')
    elif code == "TS2304" and "comment-checker" in file:
        lines[lnum] = line_content.replace('TimerHandler', 'Parameters<typeof setTimeout>[0]')
    elif code == "TS2322" and "compaction-todo-preserver" in file:
        lines[lnum] = line_content.replace('mock<any>', 'mock<any>') # need manual fix probably
        if "mock" in line_content:
            lines[lnum] = line_content.replace('mock(', 'mock<any>(')
    elif code == "TS2345" and "rules-injector" in file and "NonSharedBuffer" in line:
        lines[lnum] = line_content.replace('as NonSharedBuffer', 'as unknown as string')
        lines[lnum] = lines[lnum].replace('readFileSync: () => Buffer.from("test") as NonSharedBuffer', 'readFileSync: () => "test"')
    elif code == "TS2345" and "rules-injector" in file and "BigIntStats" in line:
        lines[lnum] = line_content.replace('fs.Stats', 'any')
        lines[lnum] = lines[lnum].replace('() => ({', '() => ({')
    elif code == "TS2554" and "semantic-loop-guard" in file:
        lines[lnum] = line_content.replace('hook["tool.execute.before"]()', 'hook["tool.execute.before"]({} as unknown as any, {} as unknown as any)')
    elif code == "TS2322" and "write-existing-file-guard" in file:
        lines[lnum] = line_content.replace('const event =', 'const event: unknown =')
    elif code == "TS7053" and "model-fallback" in file:
        lines[lnum] = line_content.replace('output.message["model"]', '(output.message as Record<string, unknown>)["model"]')
        lines[lnum] = lines[lnum].replace('output.message["variant"]', '(output.message as Record<string, unknown>)["variant"]')
    elif code == "TS7006" and "tool-execute-before-session-notification" in file:
        lines[lnum] = line_content.replace('(input) =>', '(input: unknown) =>')
    elif code == "TS2345" and "ultrawork-db-model-override" in file:
        lines[lnum] = line_content.replace('bindings: "invalid"', 'bindings: ["invalid"]')
    elif code == "TS2345" and "model-format-normalizer" in file:
        lines[lnum] = line_content.replace('normalizeModelFormat(null)', 'normalizeModelFormat(null as unknown as string)')
        lines[lnum] = lines[lnum].replace('normalizeModelFormat(undefined)', 'normalizeModelFormat(undefined as unknown as string)')
    elif code == "TS2345" and "background-task" in file:
        lines[lnum] = line_content.replace('TEST_CONTEXT', 'TEST_CONTEXT as unknown as ToolContext')
        
    with open(file, 'w') as f:
        f.writelines(lines)

