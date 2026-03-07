import re

with open("src/plugin/event.test.ts", "r") as f:
    lines = f.readlines()

# Line 290 had an extra parenthesis: } as unknown as Record<string, unknown>),
# It should be: } as unknown as Record<string, unknown>,
if len(lines) >= 290:
    lines[289] = lines[289].replace('),', ',')

with open("src/plugin/event.test.ts", "w") as f:
    f.writelines(lines)
