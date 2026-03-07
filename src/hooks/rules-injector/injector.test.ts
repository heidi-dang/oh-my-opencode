import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fs from "node:fs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as matcher from "./matcher";

const originalReadFileSync = fs.readFileSync;
const originalStatSync = fs.statSync;
const originalHomedir = os.homedir;

let trackedRulePath = "";
let statSnapshots: Array<{ mtimeMs: number; size: number } | Error> = [];
let trackedReadFileCount = 0;
let mockedHomeDir = "";

const { createRuleInjectionProcessor } = await import("./injector");

function createOutput(): { title: string; output: string; metadata: unknown } {
  return { title: "tool", output: "", metadata: {} };
}

describe("createRuleInjectionProcessor", () => {
  let readFileSyncSpy: any;
  let statSyncSpy: any;
  let homedirSpy: any;
  let shouldApplyRuleSpy: any;
  let isDuplicateByRealPathSpy: any;
  let createContentHashSpy: any;
  let isDuplicateByContentHashSpy: any;

  let testRoot: string;
  let projectRoot: string;
  let homeRoot: string;
  let targetFile: string;
  let ruleFile: string;
  let ruleRealPath: string;

  beforeEach(() => {
    readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation((filePath: any, encoding?: any) => {
      if (filePath === trackedRulePath) {
        trackedReadFileCount += 1;
      }
      return originalReadFileSync(filePath, encoding as never);
    });

    statSyncSpy = spyOn(fs, "statSync").mockImplementation((filePath: any) => {
      if (filePath === trackedRulePath) {
        const next = statSnapshots.shift();
        if (next instanceof Error) {
          throw next;
        }
        if (next) {
          return {
            mtimeMs: next.mtimeMs,
            size: next.size,
            isFile: () => true,
          } as fs.Stats;
        }
      }
      return originalStatSync(filePath);
    });

    homedirSpy = spyOn(os, "homedir").mockImplementation(() => mockedHomeDir || originalHomedir());

    shouldApplyRuleSpy = spyOn(matcher, "shouldApplyRule").mockImplementation(() => ({ applies: true, reason: "matched" }));
    isDuplicateByRealPathSpy = spyOn(matcher, "isDuplicateByRealPath").mockImplementation((realPath: string, cache: Set<string>) => cache.has(realPath));
    createContentHashSpy = spyOn(matcher, "createContentHash").mockImplementation((content: string) => `hash:${content}`);
    isDuplicateByContentHashSpy = spyOn(matcher, "isDuplicateByContentHash").mockImplementation((hash: string, cache: Set<string>) => cache.has(hash));

    testRoot = join(tmpdir(), `rules-injector-injector-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    projectRoot = join(testRoot, "project");
    homeRoot = join(testRoot, "home");
    targetFile = join(projectRoot, "src", "index.ts");
    ruleFile = join(projectRoot, ".github", "instructions", "typescript.instructions.md");

    mkdirSync(join(projectRoot, ".git"), { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    mkdirSync(join(projectRoot, ".github", "instructions"), { recursive: true });
    mkdirSync(homeRoot, { recursive: true });

    writeFileSync(targetFile, "export const value = 1;\n");
    writeFileSync(ruleFile, "rule-content\n");

    ruleRealPath = fs.realpathSync(ruleFile);
    trackedRulePath = ruleFile;
    trackedReadFileCount = 0;
    statSnapshots = [];
    mockedHomeDir = homeRoot;
  });

  afterEach(() => {
    if (readFileSyncSpy) readFileSyncSpy.mockRestore();
    if (statSyncSpy) statSyncSpy.mockRestore();
    if (homedirSpy) homedirSpy.mockRestore();
    if (shouldApplyRuleSpy) shouldApplyRuleSpy.mockRestore();
    if (isDuplicateByRealPathSpy) isDuplicateByRealPathSpy.mockRestore();
    if (createContentHashSpy) createContentHashSpy.mockRestore();
    if (isDuplicateByContentHashSpy) isDuplicateByContentHashSpy.mockRestore();

    if (fs.existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("reads and parses same file once when stat is unchanged", async () => {
    const processor = createRuleInjectionProcessor({
      workspaceDirectory: projectRoot,
      truncator: { truncate: async (_, c) => ({ result: c, truncated: false }) },
      getSessionCache: () => ({ realPaths: new Set(), contentHashes: new Set() }),
    });

    await processor.processFilePathForInjection(targetFile, "session-1", createOutput());
    await processor.processFilePathForInjection(targetFile, "session-2", createOutput());

    expect(trackedReadFileCount).toBe(1);
  });

  it("re-reads file when mtime changes", async () => {
    const processor = createRuleInjectionProcessor({
      workspaceDirectory: projectRoot,
      truncator: { truncate: async (_, c) => ({ result: c, truncated: false }) },
      getSessionCache: () => ({ realPaths: new Set(), contentHashes: new Set() }),
    });

    statSnapshots.push({ mtimeMs: 1000, size: 100 });
    await processor.processFilePathForInjection(targetFile, "session-1", createOutput());

    statSnapshots.push({ mtimeMs: 2000, size: 100 });
    await processor.processFilePathForInjection(targetFile, "session-2", createOutput());

    expect(trackedReadFileCount).toBe(2);
  });

  it("falls back to direct read and parse when statSync throws", async () => {
    const processor = createRuleInjectionProcessor({
      workspaceDirectory: projectRoot,
      truncator: { truncate: async (_, c) => ({ result: c, truncated: false }) },
      getSessionCache: () => ({ realPaths: new Set(), contentHashes: new Set() }),
    });

    statSnapshots.push(new Error("stat failed"));
    await processor.processFilePathForInjection(targetFile, "session-1", createOutput());

    statSnapshots.push(new Error("stat failed again"));
    await processor.processFilePathForInjection(targetFile, "session-2", createOutput());

    expect(trackedReadFileCount).toBe(2);
  });
});
