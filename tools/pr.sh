#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==>${NC} Starting Pre-PR Validation & Creation Pipeline"

# 1. Ensure clean and fetch latest main
echo -e "${BLUE}==>${NC} Fetching latest origin/main..."
if ! git fetch origin main; then
  echo -e "${RED}==> ERROR:${NC} Failed to fetch origin/main."
  exit 1
fi

# 2. Run strictly the Pre-PR doctor checks
echo -e "${BLUE}==>${NC} Running strict doctor pre-PR conflict gates..."
if ! python3 tools/doctor.py --prepr; then
  echo -e "${RED}==> ERROR:${NC} Strict doctor PR checks failed."
  echo "You must fix the issues listed above (rebase, dirty repo, conflicts) before opening a PR."
  exit 1
fi

echo -e "${GREEN}==> SUCCESS:${NC} Local validation passed."

# 3. Proceed to open the PR
echo -e "${BLUE}==>${NC} Opening Pull Request..."

if ! command -v gh &> /dev/null; then
  echo -e "${RED}==> ERROR:${NC} GitHub CLI (gh) tool is not installed."
  echo "Please install it, or manually open the PR using the GitHub website."
  echo "Your validation checks have passed, so you are clear to proceed manually."
  exit 1
fi

gh pr create "$@"
