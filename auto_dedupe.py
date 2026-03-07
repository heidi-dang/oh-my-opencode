import subprocess
import os

res = subprocess.run(["tsc", "--noEmit"], capture_output=True, text=True)
output = res.stdout

files_to_lines = {}
for line in output.split('\n'):
    if "TS1117" in line:
        # e.g. src/tools/look-at/create-look-at-unhandled-error.test.ts(15,5): error TS1117...
        parts = line.split('(', 1)
        if len(parts) == 2:
            filepath = parts[0].strip()
            rest = parts[1]
            line_num_str = rest.split(',', 1)[0]
            if filepath not in files_to_lines:
                files_to_lines[filepath] = []
            files_to_lines[filepath].append(int(line_num_str))

for filepath, lines_to_remove in files_to_lines.items():
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Remove lines from bottom up to avoid shifting indices
    lines_to_remove = sorted(list(set(lines_to_remove)), reverse=True)
    for ln in lines_to_remove:
        idx = ln - 1
        print(f"Removing {filepath}:{ln} -> {lines[idx].strip()}")
        del lines[idx]
        
    with open(filepath, 'w') as f:
        f.writelines(lines)
