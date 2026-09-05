import { describe, it, expect } from "bun:test"
import { filePathsFromParts, findRelevantWorktree, type PartLike } from "../src/session-files"
import type { GitWorktree } from "../src/git-status"

describe("filePathsFromParts", () => {
  it("collects absolute filePath from tool parts", () => {
    const parts: PartLike[] = [
      { type: "tool", state: { input: { filePath: "/repo/.worktrees/wt/src/a.ts" } } },
      { type: "tool", state: { input: { filePath: "/repo/src/b.ts" } } },
    ]
    expect(filePathsFromParts(parts).sort()).toEqual(["/repo/.worktrees/wt/src/a.ts", "/repo/src/b.ts"])
  })

  it("collects files from patch parts", () => {
    const parts: PartLike[] = [{ type: "patch", files: ["/repo/src/a.ts", "/repo/src/b.ts"] }]
    expect(filePathsFromParts(parts).sort()).toEqual(["/repo/src/a.ts", "/repo/src/b.ts"])
  })

  it("ignores non-string and missing paths", () => {
    const parts: PartLike[] = [
      { type: "tool", state: { input: {} } },
      { type: "tool", state: null },
      { type: "patch", files: [42, "", null] },
      { type: "text" },
    ]
    expect(filePathsFromParts(parts)).toEqual([])
  })
})

describe("findRelevantWorktree", () => {
  const worktrees: GitWorktree[] = [
    { path: "/repo", branch: "master", current: true },
    { path: "/repo/.worktrees/one", branch: "one", current: false },
    { path: "/repo/.worktrees/two", branch: "two", current: false },
  ]

  it("returns the worktree containing an edited file", () => {
    expect(findRelevantWorktree(["/repo/.worktrees/one/src/a.ts"], worktrees, "/repo")).toBe("/repo/.worktrees/one")
  })

  it("returns undefined when files only touch the main checkout", () => {
    expect(findRelevantWorktree(["/repo/src/a.ts"], worktrees, "/repo")).toBeUndefined()
  })

  it("prefers the most specific worktree on nested paths", () => {
    const nested: GitWorktree[] = [
      { path: "/repo", branch: "master", current: true },
      { path: "/repo/.worktrees", branch: "parent", current: false },
      { path: "/repo/.worktrees/one", branch: "one", current: false },
    ]
    expect(findRelevantWorktree(["/repo/.worktrees/one/a.ts"], nested, "/repo")).toBe("/repo/.worktrees/one")
  })

  it("returns undefined for an empty file list", () => {
    expect(findRelevantWorktree([], worktrees, "/repo")).toBeUndefined()
  })
})
