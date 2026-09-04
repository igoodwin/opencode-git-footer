import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { isGitDirty } from "./git-status"
import { registerFooterSlot } from "./tui-footer"

export type GitFooterDeps = {
  checkGitDirty?: (dir: string) => Promise<boolean>
}

export type GitFooterHandle = { dispose(): void }

const POLL_INTERVAL_MS = 3_000
const DEBOUNCE_MS = 250

export function runGitFooter(api: TuiPluginApi, deps: GitFooterDeps = {}): GitFooterHandle {
  const [dirty, setDirty] = createSignal(false)
  const checkGitDirty = deps.checkGitDirty ?? ((dir: string) => isGitDirty(dir))
  registerFooterSlot(api, dirty)

  let seq = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false

  const refreshNow = async () => {
    try {
      const dir = api.state.path.directory
      if (!dir) return
      const n = ++seq
      const d = await checkGitDirty(dir)
      if (n === seq) setDirty(d)
    } catch {
      // keep the last known state on transient git/state errors
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
    )
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    for (const unsub of unsubs.splice(0)) unsub()
  }

  void refreshNow()
  pollTimer = setInterval(() => void refreshNow(), POLL_INTERVAL_MS)

  api.lifecycle.onDispose(dispose)
  return { dispose }
}
