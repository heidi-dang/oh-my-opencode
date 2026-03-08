# Desloppify Baseline Scan - oh-my-opencode-heidi

## Overview

Baseline code health scan for oh-my-opencode-heidi using Desloppify v0.9.1.

## Installation Steps

### 1. Clone Desloppify (outside source tree)

```bash
git clone https://github.com/peteromallet/desloppify.git /home/heidi/work/desloppify
```

### 2. Create Python 3.11+ virtual environment

```bash
python3 -m venv /home/heidi/work/desloppify-venv
/home/heidi/work/desloppify-venv/bin/pip install --upgrade pip
```

### 3. Install Desloppify with full extras

```bash
/home/heidi/work/desloppify-venv/bin/pip install "desloppify[full]"
```

### 4. Verify installation

```bash
/home/heidi/work/desloppify-venv/bin/desloppify --version
# Output: desloppify 0.9.1
```

## Scan Commands

### Initial scan (with skip-slow for faster execution)

```bash
cd /home/heidi/work/oh-my-opencode-heidi
/home/heidi/work/desloppify-venv/bin/desloppify scan --path /home/heidi/work/oh-my-opencode-heidi --skip-slow --reset-subjective
```

### Get next prioritized issues

```bash
/home/heidi/work/desloppify-venv/bin/desloppify next
```

### Show full status

```bash
/home/heidi/work/desloppify-venv/bin/desloppify status
```

## Excluded Paths

| Pattern | Reason |
|---------|--------|
| `node_modules/**` | npm dependencies (generated) |
| `dist/**` | Build output (generated) |
| `**/*.log` | Log files (temporary) |
| `.git/**` | Git metadata |
| `packages/**` | Monorepo sub-packages |
| `.local/**` | Local runtime files |
| `.opencode/**` | OpenCode session files |
| `.runtime/**` | Runtime session files |
| `.sisyphus/**` | Sisyphus session files |
| `.github/**` | GitHub workflows/config |
| `assets/**` | Static assets |
| `benchmarks/**` | Benchmark fixtures |
| `tests/**` | Test fixtures |
| `**/*.test.ts` | Test files |
| `**/*.spec.ts` | Test files |
| `fix_*.py` | One-off fix scripts |
| `safe_fix.py` | One-off fix script |
| `parse_errors.py` | Utility script |
| `auto_dedupe.py` | Utility script |
| `clean_dupes.*` | Utility scripts |
| `signatures/**` | Signature fixtures |
| `uvscripts/**` | UV tooling scripts |
| `script/**` | Build scripts |
| `docs/**` | Documentation |

## Baseline Score

```
Score: 31.3/100 (strict)
- Overall: 31.3/100
- Objective: 78.2/100
- Verified: 78.2/100

Target: 95.0 (+63.7 to go)
```

### Scorecard Dimensions

| Dimension | Score | Strict |
|-----------|-------|--------|
| File health | 99.1% | 99.1% |
| Code quality | 86.3% | 86.3% |
| Security | 99.7% | 99.7% |
| Test health | 6.7% | 6.7% |

### Zone Statistics

- Generated: 2 files
- Production: 1,058 files
- Test: 6 files (after exclusions)

## Main Issue Categories

| Category | Issues | Percentage |
|----------|--------|------------|
| Dead exports | 698 | 24.8% |
| Test coverage | 822 | 29.3% |
| Code smells | 328 | 11.7% |
| Subjective review | 734 | 26.1% |
| Structural/coupling | 151 | 5.4% |
| Security | 15 | 0.5% |
| Logs | 14 | 0.5% |
| Deprecated | 7 | 0.2% |
| Signature variance | 12 | 0.4% |
| Low cohesion | 1 | 0.04% |

## Top 10 Prioritized Findings

### 1. Subjective Assessment (12 dimensions)
- **Cluster**: auto/initial-review
- **Items**: 12 unscored subjective dimensions
- **Run**: `desloppify review --prepare --dimensions abstraction_fitness,ai_generated_debt,contract_coherence,design_coherence,error_consistency,high_level_elegance,logic_clarity,low_level_elegance,mid_level_elegance,naming_quality,package_organization,type_safety`

### 2-9. Subjective Dimension Deficiencies (8 items)
- API coherence
- Auth consistency
- Convention drift
- Cross-module coupling
- Dependency health
- Stale migrations
- Init coupling
- Test strategy

### Security Issues (Top Priority)
- 15 security issues total
- 12 log_sensitive issues (T2 medium)
- 1 import cycle (T4 high) - 16 files
- Key files: src/cli/mcp-oauth/*.ts, src/cli/master-login/index.ts

### Structural Issues
- 2 import cycles detected
- 21 orphaned files (zero importers)
- 102 re-export facade issues
- 14 overloaded directories

## Verdict

### Is Desloppify Useful?

**YES** - Desloppify provides valuable insights:

1. **Comprehensive Detection**: Finds both mechanical issues (dead exports, unused code) and subjective issues (code elegance, naming quality)

2. **Actionable Prioritization**: The `next` and `plan` commands provide clear guidance on what to fix next

3. **Security Scanning**: Detects sensitive data logging and import cycles

4. **Score Tracking**: Provides measurable targets (95.0) with clear score breakdown

### Caveats

1. **Subjective Review Required**: 60% of the score depends on subjective LLM review, which requires API access and manual setup

2. **Slow Phases**: Duplicate detection is slow - use `--skip-slow` for faster scans

3. **Test Health Drag**: The 6.7% test health score significantly impacts overall score - this may be a measurement issue since tests are excluded

4. **False Positives**: Some issues (e.g., "dead exports" for barrel files) may need suppression

### Recommendation

Keep Desloppify as an optional tool for:
- Periodic health scans
- Security issue detection
- Tracking technical debt over time
- Guiding refactoring priorities

Not recommended for:
- Real-time CI checks (too slow)
- Blocking merges (subjective review needed first)
