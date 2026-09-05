import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { isGitDirty, resolveGitDir } from "./git-status"
import { watchGitFiles } from "./git-watch"
import { registerFooterSlot } from "./tui-footer"

export type GitFooterDeps = {
  checkGitDirty?: (dir: string) => Promise<boolean>
  resolveGitDir?: (dir: string) => Promise<string | undefined>
  watchGitFiles?: (gitDir: string, onChange: () => void) => () => void
  minRefreshMs?: number
}

export type GitFooterHandle = { dispose(): void }

const POLL_INTERVAL_MS = 3_000
const DEBOUNCE_MS = 250
const MIN_REFRESH_MS = 1_000

export function runGitFooter(api: TuiPluginApi, deps: GitFooterDeps = {}): GitFooterHandle {
  const [dirty, setDirty] = createSignal(false)
  const checkGitDirty = deps.checkGitDirty ?? ((dir: string) => isGitDirty(dir))
  const resolveDir = deps.resolveGitDir ?? ((dir: string) => resolveGitDir(dir))
  const startWatch = deps.watchGitFiles ?? ((gitDir: string, onChange: () => void) => watchGitFiles(gitDir, onChange))
  const minRefreshMs = deps.minRefreshMs ?? MIN_REFRESH_MS
  registerFooterSlot(api, dirty)

  let seq = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let trailingTimer: ReturnType<typeof setTimeout> | null = null
  let watchDispose: (() => void) | null = null
  let watchTarget: string | undefined
  let lastRefreshAt = 0
  let disposed = false

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
      if (dir !== watchTarget) void ensureWatch(dir)
      const n = ++seq
      const d = await checkGitDirty(dir)
      if (n === seq) setDirty(d)
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
