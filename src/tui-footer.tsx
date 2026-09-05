/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createEffect, createMemo, Show } from "solid-js"
import { homedir } from "node:os"
import { debugLog } from "./debug"
import { listGitWorktrees } from "./git-status"
import { collectSessionFilePaths, findRelevantWorktree } from "./session-files"

export type BranchInfo = {
  name: string
  dirty: boolean
  isDefault: boolean
}

export function describeBranch(branch: string | undefined, dirty: boolean): BranchInfo | undefined {
  if (!branch) return undefined
  return {
    name: branch,
    dirty,
    isDefault: branch === "main" || branch === "master",
  }
}

export function abbreviateHome(path: string, home: string): string {
  if (!home) return path
  if (path === home) return "~"
  const prefix = home.endsWith("/") ? home : `${home}/`
  if (path.startsWith(prefix)) return `~/${path.slice(prefix.length)}`
  return path
}

function Footer(props: { api: TuiPluginApi; sessionID: string; dirty: () => boolean }) {
  const api = props.api
  const theme = () => api.theme.current
  const home = () => homedir()

  const has = createMemo(() =>
    api.state.provider.some(
      (item) => item.id !== "opencode" || Object.values(item.models).some((model) => model.cost?.input !== 0),
    ),
  )
  const done = createMemo(() => api.kv.get("dismissed_getting_started", false))
  const show = createMemo(() => !has() && !done())

  const branchInfo = createMemo(() => {
    const branch = api.state.vcs?.branch
    if (!branch) return undefined
    const info = describeBranch(branch, props.dirty())
    if (!info) return undefined
    return { ...info, dotColor: info.dirty ? theme().warning : theme().success }
  })

  const path = createMemo(() => {
    const session = api.state.session.get(props.sessionID)
    const dir = session?.directory || api.state.path.directory || home()
    const branch = session?.directory === api.state.path.directory ? api.state.vcs?.branch : undefined
    const out = abbreviateHome(dir, home())
    const text = branch ? `${out}:${branch}` : out
    const list = text.split("/")
    return {
      parent: list.slice(0, -1).join("/"),
      name: list.at(-1) ?? "",
    }
  })

  const dotColor = () => branchInfo()?.dotColor ?? theme().success

  createEffect(() => {
    const session = api.state.session.get(props.sessionID)
    const files = collectSessionFilePaths(api, props.sessionID)
    debugLog("footer", {
      sessionID: props.sessionID,
      session_directory: session?.directory,
      session_path: session?.path,
      path_directory: api.state.path.directory,
      path_worktree: api.state.path.worktree,
      vcs_branch: api.state.vcs?.branch,
      session_files: files,
    })
    const dir = api.state.path.directory
    if (!dir) return
    void (async () => {
      const worktrees = await listGitWorktrees(dir)
      const relevant = findRelevantWorktree(files, worktrees, dir)
      debugLog("relevant", { files, worktrees, relevant })
    })()
  })

  return (
    <box gap={1}>
      <Show when={show()}>
        <box
          backgroundColor={theme().backgroundElement}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          flexDirection="row"
          gap={1}
        >
          <text flexShrink={0} fg={theme().text}>
            ⬖
          </text>
          <box flexGrow={1} gap={1}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={theme().text}>
                <b>Getting started</b>
              </text>
              <text fg={theme().textMuted} onMouseDown={() => api.kv.set("dismissed_getting_started", true)}>
                ✕
              </text>
            </box>
            <text fg={theme().textMuted}>OpenCode includes free models so you can start immediately.</text>
            <text fg={theme().textMuted}>
              Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc
            </text>
            <box flexDirection="row" gap={1} justifyContent="space-between">
              <text fg={theme().text}>Connect provider</text>
              <text fg={theme().textMuted}>/connect</text>
            </box>
          </box>
        </box>
      </Show>
      <box flexDirection="row" gap={0}>
        <text fg={theme().textMuted}>{path().parent}/</text>
        <text fg={theme().text}>{path().name}</text>
        <text fg={dotColor()}>{branchInfo() ? " ●" : ""}</text>
      </box>
      <text fg={theme().textMuted}>
        <span style={{ fg: theme().success }}>•</span> <b>Open</b>
        <span style={{ fg: theme().text }}>
          <b>Code</b>
        </span>{" "}
        <span>{api.app.version}</span>
      </text>
    </box>
  )
}

export function registerFooterSlot(api: TuiPluginApi, dirty: () => boolean): void {
  api.slots.register({
    order: 50,
    slots: {
      sidebar_footer(_ctx, props) {
        return <Footer api={api} sessionID={props.session_id} dirty={dirty} />
      },
    },
  })
}
