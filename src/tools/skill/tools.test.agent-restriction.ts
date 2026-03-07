import { describe, expect, it } from "bun:test"
import { createSkillTool } from "./tools"
import { createMockSkill, mockContext } from "./tools.test.utils"

describe("skill tool - agent restriction", () => {
  it("allows skill without agent restriction to any agent", async () => {
    // given
    const loadedSkills = [createMockSkill("public-skill")]
    const tool = createSkillTool({ skills: loadedSkills })
    const context = { ...mockContext, agent: "any-agent" }

    // when
    const result = await tool.execute({ name: "public-skill" }, context)

    // then
    expect(result).toContain("public-skill")
  })

  it("allows skill when agent matches restriction", async () => {
    // given
    const loadedSkills = [createMockSkill("restricted-skill", { agent: "sisyphus" })]
    const tool = createSkillTool({ skills: loadedSkills })
    const context = { ...mockContext, agent: "sisyphus" }

    // when
    const result = await tool.execute({ name: "restricted-skill" }, context)

    // then
    expect(result).toContain("restricted-skill")
  })

  it("throws error when agent does not match restriction", async () => {
    // given
    const loadedSkills = [createMockSkill("sisyphus-only-skill", { agent: "sisyphus" })]
    const tool = createSkillTool({ skills: loadedSkills })
    const context = { ...mockContext, agent: "oracle" }

    // when / #then
    await expect(tool.execute({ name: "sisyphus-only-skill" }, context)).rejects.toThrow(
      'Skill "sisyphus-only-skill" is restricted to agent "sisyphus"'
    )
  })

  it("throws error when context agent is undefined for restricted skill", async () => {
    // given
    const loadedSkills = [createMockSkill("sisyphus-only-skill", { agent: "sisyphus" })]
    const tool = createSkillTool({ skills: loadedSkills })
    const contextWithoutAgent = { ...mockContext, agent: undefined as unknown as string }

    // when / #then
    await expect(tool.execute({ name: "sisyphus-only-skill" }, contextWithoutAgent)).rejects.toThrow(
      'Skill "sisyphus-only-skill" is restricted to agent "sisyphus"'
    )
  })
})
