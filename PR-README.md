# Pull Request Pre-flight Checklist

To ensure minimal CI failures and merge conflicts, this repository strictly enforces a pre-PR script. Please review this prior to submitting code.

1. Did you run `./tools/start-task.sh <your-branch>` prior to writing code?
2. Did you run `python3 tools/doctor.py --prepr` immediately before committing?
3. Did you use `./tools/pr.sh` to open this pull request securely?

If `doctor.py --prepr` failed, it is likely because:
- **A.** `main` has moved forward since you created your branch. You must re-run `start-task.sh <your-branch>` to rebase cleanly.
- **B.** Someone else edited the exact same file (a conflict risk). Review the exact overlapping files the script listed.
- **C.** Your repository state was dirty.

Run `./tools/pr.sh` only after fixing these underlying states. This prevents you from forcing collaborators to resolve your blind conflicts!

---

*For detailed explanations of the workflow scripts, please read `docs/dev-start-workflow.md`.*
