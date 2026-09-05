import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { GitWorktree } from "./git-status"

export type PartLike = {
  type?: string
  files?: unknown
  state?: { input?: Record<string, unknown> } | null
}

/**
 * Extract absolute file paths touched by a message's parts.
 * - tool parts: edit/write/apply_patch store `state.input.filePath` (absolute)
 * - patch parts: `files` are absolute paths produced by the snapshot
 */
export function filePathsFromParts(parts: readonly PartLike[]): string[] {
  const paths = new Set<string>()
  for (const part of parts) {
    if (part.type === "patch" && Array.isArray(part.files)) {
      for (const file of part.files) if (typeof file === "string" && file) paths.add(file)
      continue
    }
    if (part.type === "tool") {
      const filePath = part.state?.input?.filePath
      if (typeof filePath === "string" && filePath) paths.add(filePath)
    }
  }
  return [...paths]
}

/**
 * Pick the worktree (if any) that contains the edited files. Falls back to
 * `undefined` when every file lives in the main checkout. Longest-prefix wins
 * so nested paths resolve to the most specific worktree.
 */
export function findRelevantWorktree(
  files: readonly string[],
  worktrees: readonly GitWorktree[],
  mainDirectory: string,
): string | undefined {
  let best: string | undefined
  let bestLength = -1
  for (const file of files) {
    for (const wt of worktrees) {
      if (!wt.path || wt.path === mainDirectory) continue
      if (file === wt.path || file.startsWith(`${wt.path}/`)) {
        if (wt.path.length > bestLength) {
          best = wt.path
          bestLength = wt.path.length
        }
      }
    }
  }
  return best
}

export function collectSessionFilePaths(api: TuiPluginApi, sessionID: string | undefined): string[] {
  if (!sessionID) return []
  try {
    const paths = new Set<string>()
    for (const message of api.state.session.messages(sessionID)) {
      const parts = api.state.part(message.id) as unknown as PartLike[]
      for (const file of filePathsFromParts(parts)) paths.add(file)
    }
    return [...paths]
  } catch {
    return []
  }
}
