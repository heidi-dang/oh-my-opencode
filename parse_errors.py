import collections
with open('tsc_fixed.log') as f:
    lines = [L.strip() for L in f.readlines() if 'error TS' in L]
counts = collections.Counter([L.split(':', 1)[1].strip() for L in lines])
for k, v in counts.most_common(15):
    print(f"{v}x: {k}")
