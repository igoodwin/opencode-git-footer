/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, Show } from "solid-js"
import { homedir } from "node:os"

export type GitFooterState = {
  activeDir: () => string | undefined
  branch: () => string | undefined
  dirty: () => boolean
  isWorktree: () => boolean
}

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

function Footer(props: { api: TuiPluginApi; state: GitFooterState }) {
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
    const branch = props.state.branch()
    if (!branch) return undefined
    const info = describeBranch(branch, props.state.dirty())
    if (!info) return undefined
    return { ...info, dotColor: info.dirty ? theme().warning : theme().success }
  })

  const path = createMemo(() => {
    const dir = props.state.activeDir() || api.state.path.directory || home()
    const branch = props.state.branch()
    if (props.state.isWorktree()) {
      const name = dir.split("/").filter(Boolean).at(-1) ?? dir
      const label = branch && branch !== name ? `${name}:${branch}` : name
      return { parent: "", name: `⧉ ${label}` }
    }
    const out = abbreviateHome(dir, home())
    const text = branch ? `${out}:${branch}` : out
    const list = text.split("/")
    return {
      parent: list.slice(0, -1).join("/"),
      name: list.at(-1) ?? "",
    }
  })

  const dotColor = () => branchInfo()?.dotColor ?? theme().success

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
        <Show when={path().parent}>
          <text fg={theme().textMuted}>{path().parent}/</text>
        </Show>
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

export function registerFooterSlot(
  api: TuiPluginApi,
  state: GitFooterState,
  onSession?: (sessionID: string) => void,
): void {
  api.slots.register({
    order: 50,
    slots: {
      sidebar_footer(_ctx, props) {
        onSession?.(props.session_id)
        return <Footer api={api} state={state} />
      },
    },
  })
}
