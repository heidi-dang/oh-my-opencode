import type { BuiltinSkill } from "../types"

import {
  GIT_MASTER_SKILL_DESCRIPTION,
  GIT_MASTER_SKILL_NAME,
} from "./git-master-skill-metadata"

import { GIT_SHARED_HEADER, GIT_SHARED_ANTI_PATTERNS } from "./git/git-shared"
import { GIT_COMMIT_PHASES, GIT_COMMIT_QUICK_REF } from "./git/git-commit"
import { GIT_PUSH_PR_PHASE } from "./git/git-push-pr"
import { GIT_REBASE_PHASE } from "./git/git-rebase"
import { GIT_HISTORY_PHASE } from "./git/git-history"

export const gitMasterSkill: BuiltinSkill = {
  name: GIT_MASTER_SKILL_NAME,
  description: GIT_MASTER_SKILL_DESCRIPTION,
  template: [
    "# Git Master Agent",
    GIT_SHARED_HEADER,
    GIT_COMMIT_PHASES,
    GIT_PUSH_PR_PHASE,
    GIT_COMMIT_QUICK_REF,
    GIT_REBASE_PHASE,
    GIT_HISTORY_PHASE,
    GIT_SHARED_ANTI_PATTERNS
  ].join("\\n\\n")
}
