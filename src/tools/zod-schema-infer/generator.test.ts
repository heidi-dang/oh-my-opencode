import { describe, test, expect } from "bun:test"
import { inferZodSchema } from "./generator"

describe("zod-schema-infer", () => {
  test("inferZodSchema should infer a basic Zod schema from JSON", () => {
    const jsonStr = '{"name": "test", "value": 123, "active": true}'
    const schema = inferZodSchema(jsonStr)

    expect(schema).toContain('name: z.string()')
    expect(schema).toContain('value: z.number()')
    expect(schema).toContain('active: z.boolean()')
  })

  test("inferZodSchema should handle nested objects", () => {
    const jsonStr = '{"user": {"id": 1, "profile": {"bio": "hello"}}}'
    const schema = inferZodSchema(jsonStr)

    expect(schema).toContain('user: z.object({')
    expect(schema).toContain('profile: z.object({')
    expect(schema).toContain('bio: z.string()')
  })

  test("inferZodSchema should handle arrays", () => {
    const jsonStr = '{"tags": ["a", "b"]}'
    const schema = inferZodSchema(jsonStr)

    expect(schema).toContain('tags: z.array(z.string())')
  })
})
