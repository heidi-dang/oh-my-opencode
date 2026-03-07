import { describe, expect, it } from "bun:test"
import { createSkillTool } from "./tools"
import { createMockSkillWithScope, createMockCommand } from "./tools.test.utils"

describe("skill tool - ordering and priority", () => {
  it("lists skills before commands in available_items", () => {
    //#given: mix of skills and commands
    const skills = [
      createMockSkillWithScope("builtin-skill", "builtin"),
      createMockSkillWithScope("project-skill", "project"),
    ]
    const commands = [
      createMockCommand("project-cmd", "project"),
      createMockCommand("builtin-cmd", "builtin"),
    ]

    //#when: creating tool with both
    const tool = createSkillTool({ skills, commands })

    //#then: skills should appear before commands
    const desc = tool.description
    const skillIndex = desc.indexOf("<skill>")
    const commandIndex = desc.indexOf("<command>")
    expect(skillIndex).toBeGreaterThan(0)
    expect(commandIndex).toBeGreaterThan(0)
    expect(skillIndex).toBeLessThan(commandIndex)
  })

  it("sorts skills by priority: project > user > opencode > builtin", () => {
    //#given: skills in random order
    const skills = [
      createMockSkillWithScope("builtin-skill", "builtin"),
      createMockSkillWithScope("opencode-skill", "opencode"),
      createMockSkillWithScope("project-skill", "project"),
      createMockSkillWithScope("user-skill", "user"),
    ]

    //#when: creating tool
    const tool = createSkillTool({ skills })

    //#then: should be sorted by priority
    const desc = tool.description
    const projectIndex = desc.indexOf("project-skill")
    const userIndex = desc.indexOf("user-skill")
    const opencodeIndex = desc.indexOf("opencode-skill")
    const builtinIndex = desc.indexOf("builtin-skill")

    expect(projectIndex).toBeLessThan(userIndex)
    expect(userIndex).toBeLessThan(opencodeIndex)
    expect(opencodeIndex).toBeLessThan(builtinIndex)
  })

  it("sorts commands by priority: project > user > opencode > builtin", () => {
    //#given: commands in random order
    const commands = [
      createMockCommand("builtin-cmd", "builtin"),
      createMockCommand("opencode-cmd", "opencode"),
      createMockCommand("project-cmd", "project"),
      createMockCommand("user-cmd", "user"),
    ]

    //#when: creating tool
    const tool = createSkillTool({ commands })

    //#then: should be sorted by priority
    const desc = tool.description
    const projectIndex = desc.indexOf("project-cmd")
    const userIndex = desc.indexOf("user-cmd")
    const opencodeIndex = desc.indexOf("opencode-cmd")
    const builtinIndex = desc.indexOf("builtin-cmd")

    expect(projectIndex).toBeLessThan(userIndex)
    expect(userIndex).toBeLessThan(opencodeIndex)
    expect(opencodeIndex).toBeLessThan(builtinIndex)
  })

  it("includes priority documentation in description", () => {
    //#given: some skills and commands
    const skills = [createMockSkillWithScope("test-skill", "project")]
    const commands = [createMockCommand("test-cmd", "project")]

    //#when: creating tool
    const tool = createSkillTool({ skills, commands })

    //#then: should include priority info
    expect(tool.description).toContain("Priority: project > user > opencode > builtin/plugin")
    expect(tool.description).toContain("Skills listed before commands")
  })

  it("uses <available_items> wrapper with unified format", () => {
    //#given: mix of skills and commands
    const skills = [createMockSkillWithScope("test-skill", "project")]
    const commands = [createMockCommand("test-cmd", "project")]

    //#when: creating tool
    const tool = createSkillTool({ skills, commands })

    //#then: should use unified wrapper
    expect(tool.description).toContain("<available_items>")
    expect(tool.description).toContain("</available_items>")
    expect(tool.description).toContain("<skill>")
    expect(tool.description).toContain("<command>")
  })
})
