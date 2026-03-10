import type { LanguagePack } from "../types"

export const pythonPack: LanguagePack = {
  language: "python",
  displayName: "Python",
  rules: [
    "Always use a virtual environment (venv, conda, or uv) — never install packages globally.",
    "Prefer `python -m module` over direct script execution for packages with __main__.py.",
    "Check for editable installs (`pip install -e .`) when local imports fail.",
    "Use `pyproject.toml` over `setup.py` for new projects.",
    "Respect the project's existing formatter (ruff, black, autopep8) — do not introduce a new one.",
    "Always check `sys.path` when debugging import errors before modifying code.",
    "Use `__init__.py` files for package directories — their absence breaks imports.",
    "Prefer `pathlib.Path` over `os.path` for new code unless the project uses `os.path` consistently.",
    "Run tests from the project root, not from inside the test directory.",
    "When adding dependencies, update `pyproject.toml` or `requirements.txt` — never leave untracked deps.",
  ],
  repairSteps: {
    "ModuleNotFoundError": [
      "1. Check if the module is installed: `pip list | grep <module>`",
      "2. If not installed: `pip install <module>` (inside the venv)",
      "3. If it's a local module: check for `__init__.py` and ensure editable install: `pip install -e .`",
      "4. Verify sys.path includes the project root: `python -c 'import sys; print(sys.path)'`",
    ],
    "ImportError": [
      "1. Check circular imports — restructure if A imports B imports A",
      "2. Verify the module's `__init__.py` exports the expected names",
      "3. Check for name shadowing — a local file named the same as a stdlib module",
    ],
    "SyntaxError": [
      "1. Check Python version compatibility — f-strings require 3.6+, walrus 3.8+, match 3.10+",
      "2. Look for mixed tabs/spaces",
      "3. Check for unclosed brackets or strings",
    ],
    "PermissionError": [
      "1. Check file permissions: `ls -la <file>`",
      "2. If writing to a read-only location, change the output path",
      "3. Check if a venv needs to be activated",
    ],
    "FileNotFoundError": [
      "1. Verify CWD: the script may expect to run from the project root",
      "2. Check for relative path assumptions — use `Path(__file__).parent` for script-relative paths",
      "3. Verify the file exists at the expected path",
    ],
    "venv-missing": [
      "1. Create venv: `python3 -m venv .venv`",
      "2. If `venv` module missing: `sudo apt install python3-venv` (Debian/Ubuntu)",
      "3. Activate: `source .venv/bin/activate`",
      "4. Install deps: `pip install -r requirements.txt` or `pip install -e '.[dev]'`",
    ],
  },
  commandRecipes: {
    "create-venv": "python3 -m venv .venv && source .venv/bin/activate",
    "install-deps": "pip install -r requirements.txt",
    "install-dev": "pip install -e '.[dev]'",
    "run-tests": "python -m pytest -xvs",
    "run-tests-coverage": "python -m pytest --cov=. --cov-report=term-missing",
    "lint": "ruff check .",
    "format": "ruff format .",
    "typecheck": "mypy .",
    "run-module": "python -m <package_name>",
    "freeze-deps": "pip freeze > requirements.txt",
  },
  failureSignatures: [
    { pattern: "ModuleNotFoundError: No module named", diagnosis: "Missing dependency or broken imports", fix: ["Check pip list", "pip install the missing module", "Check for editable install"] },
    { pattern: "ImportError: cannot import name", diagnosis: "Circular import or missing export", fix: ["Check __init__.py exports", "Look for circular imports"] },
    { pattern: "No module named 'venv'", diagnosis: "python3-venv not installed on system", fix: ["apt install python3-venv", "Or use: python3 -m pip install virtualenv"] },
    { pattern: "command not found: python", diagnosis: "Python not on PATH or not installed", fix: ["Try python3", "Check PATH", "Install Python"] },
    { pattern: "pip: command not found", diagnosis: "pip not installed or not on PATH", fix: ["python3 -m pip install --upgrade pip", "Or: apt install python3-pip"] },
    { pattern: "editable installs require", diagnosis: "Missing pyproject.toml for editable install", fix: ["Create pyproject.toml with [build-system]", "Use setup.py as fallback"] },
    { pattern: "error: externally-managed-environment", diagnosis: "PEP 668 — system Python blocks global installs", fix: ["Use a venv: python3 -m venv .venv", "Or: pip install --break-system-packages (not recommended)"] },
    { pattern: "FAILED", diagnosis: "Pytest test failure", fix: ["Read the FAILED line for the test name", "Read the assertion error", "Fix the code or the test"] },
    { pattern: "E   assert", diagnosis: "Pytest assertion failure", fix: ["Compare expected vs actual", "Check test data", "Check function under test"] },
    { pattern: "SyntaxError: invalid syntax", diagnosis: "Python syntax error", fix: ["Check Python version compat", "Look for missing colons, brackets, or f-string issues"] },
    { pattern: "IndentationError", diagnosis: "Inconsistent indentation", fix: ["Convert tabs to spaces (4)", "Match surrounding code's indentation"] },
    { pattern: "TypeError: __init__() got an unexpected keyword argument", diagnosis: "Wrong constructor arguments", fix: ["Check the class signature", "Check for API version changes"] },
  ],
  importPatterns: `Python import conventions:
- Use absolute imports from the project root: \`from mypackage.module import func\`
- Relative imports only inside packages: \`from .sibling import thing\`
- Group imports: stdlib → third-party → local (separated by blank lines)
- Never use \`import *\` in production code`,
  buildFlow: `Python build flow:
1. Create/activate venv
2. Install dependencies: pip install -r requirements.txt OR pip install -e '.[dev]'
3. Run the project: python -m <package> OR python <script.py>`,
  testFlow: `Python test flow:
1. Install test deps: pip install -e '.[dev]' or pip install pytest
2. Run from project root: python -m pytest -xvs
3. For coverage: python -m pytest --cov=. --cov-report=term-missing
4. For specific test: python -m pytest tests/test_foo.py::test_bar -xvs`,
  lintFlow: `Python lint flow:
1. Ruff (preferred): ruff check . && ruff format .
2. Mypy: mypy . --strict
3. Black: black . (only if project uses black)
4. Flake8: flake8 . (legacy — prefer ruff)`,
}
