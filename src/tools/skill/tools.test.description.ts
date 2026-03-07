import { describe, expect, it } from "bun:test"
import { createSkillTool } from "./tools"
import { createMockSkill } from "./tools.test.utils"

describe("skill tool - synchronous description", () => {
  it("includes available_items immediately when skills are pre-provided", () => {
    // given
    const loadedSkills = [createMockSkill("test-skill")]

    // when
    const tool = createSkillTool({ skills: loadedSkills })

    // then
    expect(tool.description).toContain("<available_items>")
    expect(tool.description).toContain("test-skill")
  })

  it("includes all pre-provided skills in available_items immediately", () => {
    // given
    const loadedSkills = [
      createMockSkill("playwright"),
      createMockSkill("frontend-ui-ux"),
      createMockSkill("git-master"),
    ]

    // when
    const tool = createSkillTool({ skills: loadedSkills })

    // then
    expect(tool.description).toContain("<available_items>")
    expect(tool.description).toContain("playwright")
    expect(tool.description).toContain("frontend-ui-ux")
    expect(tool.description).toContain("git-master")
  })

  it("shows no-skills message immediately when empty skills are pre-provided", () => {
    // given / #when
    const tool = createSkillTool({ skills: [] })

    // then
    expect(tool.description).toContain("No skills are currently available")
  })
})
