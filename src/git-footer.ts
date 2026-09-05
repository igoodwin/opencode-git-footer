import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { isGitDirty, resolveGitDir, gitBranch, isGitWorktree, listGitWorktrees, type GitWorktree } from "./git-status"
import { watchGitFiles } from "./git-watch"
import { registerFooterSlot } from "./tui-footer"
import { collectSessionFilePaths, findRelevantWorktree } from "./session-files"
import { debugLog } from "./debug"

export type GitFooterDeps = {
  checkGitDirty?: (dir: string) => Promise<boolean>
  resolveGitDir?: (dir: string) => Promise<string | undefined>
  gitBranch?: (dir: string) => Promise<string | undefined>
  isGitWorktree?: (dir: string) => Promise<boolean>
  listGitWorktrees?: (dir: string) => Promise<GitWorktree[]>
  collectSessionFilePaths?: (api: TuiPluginApi, sessionID?: string) => string[]
  findRelevantWorktree?: (files: string[], worktrees: GitWorktree[], mainDirectory: string) => string | undefined
  watchGitFiles?: (gitDir: string, onChange: () => void) => () => void
  minRefreshMs?: number
}

export type GitFooterHandle = { dispose(): void }

const POLL_INTERVAL_MS = 3_000
const DEBOUNCE_MS = 250
const MIN_REFRESH_MS = 1_000

export function runGitFooter(api: TuiPluginApi, deps: GitFooterDeps = {}): GitFooterHandle {
  const [activeDir, setActiveDir] = createSignal<string | undefined>(undefined)
  const [branch, setBranch] = createSignal<string | undefined>(undefined)
  const [dirty, setDirty] = createSignal(false)
  const [isWorktree, setIsWorktree] = createSignal(false)

  const checkGitDirty = deps.checkGitDirty ?? ((dir: string) => isGitDirty(dir))
  const resolveDir = deps.resolveGitDir ?? ((dir: string) => resolveGitDir(dir))
  const getBranch = deps.gitBranch ?? ((dir: string) => gitBranch(dir))
  const checkWorktree = deps.isGitWorktree ?? ((dir: string) => isGitWorktree(dir))
  const getWorktrees = deps.listGitWorktrees ?? ((dir: string) => listGitWorktrees(dir))
  const getSessionFiles = deps.collectSessionFilePaths ?? ((api: TuiPluginApi, sid?: string) => collectSessionFilePaths(api, sid))
  const relevantWorktree = deps.findRelevantWorktree ?? findRelevantWorktree
  const startWatch = deps.watchGitFiles ?? ((gitDir: string, onChange: () => void) => watchGitFiles(gitDir, onChange))
  const minRefreshMs = deps.minRefreshMs ?? MIN_REFRESH_MS

  let sessionID: string | undefined
  registerFooterSlot(api, { activeDir, branch, dirty, isWorktree }, (sid) => {
    sessionID = sid
  })

  let seq = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let trailingTimer: ReturnType<typeof setTimeout> | null = null
  let watchDispose: (() => void) | null = null
  let watchTarget: string | undefined
  let lastRefreshAt = 0
  let disposed = false

  const determineActiveDir = async (dir: string) => {
    const [worktrees, linked] = await Promise.all([getWorktrees(dir), checkWorktree(dir)])
    // Launched directly inside a linked worktree: `dir` already is the right
    // folder, no need to inspect the session.
    let active = dir
    if (!linked) {
      const files = getSessionFiles(api, sessionID)
      const found = relevantWorktree(files, worktrees, api.state.path.worktree || dir)
      if (found) active = found
    }
    return { active, worktree: linked || active !== dir, worktrees }
  }

  const refreshNow = async () => {
    const now = Date.now()
    if (now - lastRefreshAt < minRefreshMs) {
      if (!trailingTimer) {
        trailingTimer = setTimeout(() => {
          trailingTimer = null
          void refreshNow()
        }, minRefreshMs)
      }
      return
    }
    lastRefreshAt = now
    try {
      const dir = api.state.path.directory
      if (!dir) return
      const n = ++seq
      const { active, worktree, worktrees } = await determineActiveDir(dir)
      if (active !== watchTarget) void ensureWatch(active)
      const [d, br] = await Promise.all([checkGitDirty(active), getBranch(active)])
      debugLog("refresh", {
        directory: dir,
        active,
        path_worktree: api.state.path.worktree,
        vcs_branch: api.state.vcs?.branch,
        git_branch: br,
        is_linked_worktree: worktree,
        dirty: d,
        worktrees,
      })
      if (n === seq) {
        setDirty(d)
        setBranch(br)
        setActiveDir(active)
        setIsWorktree(worktree)
      }
    } catch {
      // keep the last known state on transient git/state errors
    }
  }

  const ensureWatch = async (dir: string) => {
    if (disposed) return
    watchTarget = dir
    watchDispose?.()
    watchDispose = null
    try {
      const gitDir = await resolveDir(dir)
      debugLog("ensureWatch", { directory: dir, gitDir })
      if (!gitDir || disposed) return
      watchDispose = startWatch(gitDir, () => scheduleRefresh())
    } catch {
      // watcher is best-effort; the poll still keeps dirty state fresh
    }
  }

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void refreshNow()
    }, DEBOUNCE_MS)
  }

  const unsubs: Array<() => void> = []
  if (api.event) {
    unsubs.push(
      api.event.on("vcs.branch.updated", () => scheduleRefresh()),
      api.event.on("file.edited", () => scheduleRefresh()),
      api.event.on("file.watcher.updated", () => scheduleRefresh()),
      api.event.on("command.executed", () => scheduleRefresh()),
      api.event.on("session.next.shell.ended", () => scheduleRefresh()),
      api.event.on("session.idle", () => scheduleRefresh()),
    )
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    if (trailingTimer) clearTimeout(trailingTimer)
    trailingTimer = null
    watchDispose?.()
    watchDispose = null
    for (const unsub of unsubs.splice(0)) unsub()
  }

  void refreshNow()
  pollTimer = setInterval(() => void refreshNow(), POLL_INTERVAL_MS)

  api.lifecycle.onDispose(dispose)
  return { dispose }
}
