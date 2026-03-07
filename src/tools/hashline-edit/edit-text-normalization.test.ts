import { expect, test, describe } from "bun:test"
import { toNewLines } from "./edit-text-normalization"

describe("edit text normalization - toNewLines", () => {
    test("handles normal single line strings", () => {
        expect(toNewLines("hello")).toEqual(["hello"])
    })

    test("handles normal multiline strings", () => {
        expect(toNewLines("hello\nworld")).toEqual(["hello", "world"])
    })

    test("unescapes double-escaped newlines in a single string payload", () => {
        // This represents a JSON payload where the LLM wrote "line1\\nline2"
        expect(toNewLines("hello\\nworld")).toEqual(["hello", "world"])
        expect(toNewLines("stages = [\\n  ('scrape', stage_scrape),\\n]")).toEqual([
            "stages = [",
            "  ('scrape', stage_scrape),",
            "]"
        ])
    })

    test("does not unescape if actual newlines exist (preserves intended python literals)", () => {
        // e.g. def foo():\n  print('hello\\n')
        expect(toNewLines("def foo():\n  print('hello\\\\n')")).toEqual([
            "def foo():",
            "  print('hello\\\\n')"
        ])
    })

    test("handles arrays of strings normally", () => {
        expect(toNewLines(["hello", "world"])).toEqual(["hello", "world"])
    })

    test("removes trailing \\n from array items if they have no actual newlines", () => {
        expect(toNewLines(["hello\\n", "world\\n"])).toEqual(["hello", "world"])
    })

    test("does not tamper with array items that have actual newlines", () => {
        expect(toNewLines(["hello\n", "world"])).toEqual(["hello\n", "world"])
    })
})
