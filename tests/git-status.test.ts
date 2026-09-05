import { describe, it, expect } from "bun:test"
import { isDirty, runGitStatus, isGitDirty, resolveGitDir, type CommandRunner } from "../src/git-status"

describe("isDirty", () => {
  it("returns false for empty output", () => {
    expect(isDirty("")).toBe(false)
  })

  it("returns false for whitespace-only output", () => {
    expect(isDirty("  \n\t\n  ")).toBe(false)
  })

  it("returns true when porcelain output has a changed file", () => {
    expect(isDirty(" M src/foo.ts\n?? untracked.txt")).toBe(true)
  })
})

describe("runGitStatus", () => {
  it("runs git status --porcelain in the given directory", async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = []
    const run: CommandRunner = async (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd })
      return " M a.ts"
    }

    const out = await runGitStatus("/work/repo", run)

    expect(calls).toEqual([{ cmd: "git", args: ["--no-optional-locks", "status", "--porcelain"], cwd: "/work/repo" }])
    expect(out).toBe(" M a.ts")
  })

  it("returns empty string when the runner throws (not a repo / git missing)", async () => {
    const run: CommandRunner = async () => {
      throw new Error("exit 128")
    }

    expect(await runGitStatus("/not/a/repo", run)).toBe("")
  })
})

describe("isGitDirty", () => {
  it("returns true when porcelain output is non-empty", async () => {
    const run: CommandRunner = async () => "?? new.ts"
    expect(await isGitDirty("/work/repo", run)).toBe(true)
  })

  it("returns false when porcelain output is empty", async () => {
    const run: CommandRunner = async () => ""
    expect(await isGitDirty("/work/repo", run)).toBe(false)
  })
})

describe("resolveGitDir", () => {
  it("returns an absolute git dir unchanged", async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd: string }> = []
    const run: CommandRunner = async (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd })
      return "/work/repo/.git\n"
    }

    expect(await resolveGitDir("/work/repo", run)).toBe("/work/repo/.git")
    expect(calls).toEqual([{ cmd: "git", args: ["rev-parse", "--git-dir"], cwd: "/work/repo" }])
  })

  it("resolves a relative git dir against the repo root", async () => {
    const run: CommandRunner = async () => ".git\n"
    expect(await resolveGitDir("/work/repo", run)).toBe("/work/repo/.git")
  })

  it("returns undefined when the runner throws (not a repo)", async () => {
    const run: CommandRunner = async () => {
      throw new Error("exit 128")
    }
    expect(await resolveGitDir("/not/a/repo", run)).toBeUndefined()
  })
})
