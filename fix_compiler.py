import re
import os

files = [
    "src/hooks/plan-enforcement/hook.test.ts",
    "src/plugin/truth-model-integration.test.ts"
]

for file in files:
    if not os.path.exists(file): continue
    with open(file, 'r') as f: content = f.read()
    
    # Replace compiler.submit([...]) with compiler.submit("", { sessionID: "test" } as any)
    # The first arg is now a string, second is options
    content = re.sub(r'compiler\.submit\(\[\]\)', 'compiler.submit("", { sessionID: "test" } as any)', content)
    content = re.sub(r'compiler\.submit\(\[\{', 'compiler.submit("", { sessionID: "test" } as any); (', content)
    
    with open(file, 'w') as f: f.write(content)

