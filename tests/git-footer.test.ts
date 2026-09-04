import { describe, it, expect, mock } from "bun:test"
import { runGitFooter } from "../src/git-footer"

function fakeApi() {
  const handlers = new Map<string, Array<(event: any) => void>>()
  const slotRegistrations: Array<any> = []
  const lifecycle: Array<() => void> = []
  const api = {
    slots: { register: mock((plugin: any) => { slotRegistrations.push(plugin); return "slot-1" }) },
    state: { path: { directory: "/repo" } },
    event: {
      on: (type: string, handler: (event: any) => void) => {
        const list = handlers.get(type) ?? []
        list.push(handler)
        handlers.set(type, list)
        return () => {}
      },
    },
    lifecycle: { onDispose: (cb: () => void) => lifecycle.push(cb) },
  }
  const emit = (type: string, event: Record<string, unknown> = {}) => {
    for (const h of handlers.get(type) ?? []) h({ type, ...event })
  }
  return { api: api as any, slotRegistrations, lifecycle, emit }
}

describe("runGitFooter", () => {
  it("registers the sidebar footer slot below the builtin order", () => {
    const f = fakeApi()
    const handle = runGitFooter(f.api)

    expect(f.slotRegistrations).toHaveLength(1)
    expect(f.slotRegistrations[0].order).toBeLessThan(100)
    expect(typeof f.slotRegistrations[0].slots?.sidebar_footer).toBe("function")

    handle.dispose()
  })

  it("checks dirty on init and refreshes on file.edited events", async () => {
    const f = fakeApi()
    const checkGitDirty = mock(async (_dir: string) => true)
    const handle = runGitFooter(f.api, { checkGitDirty })
    await Bun.sleep(10)

    expect(checkGitDirty).toHaveBeenCalledTimes(1)

    f.emit("file.edited", { properties: { file: "/repo/a.ts" } })
    await Bun.sleep(400)

    expect(checkGitDirty).toHaveBeenCalledTimes(2)

    handle.dispose()
  })

  it("refreshes when a shell command ends (e.g. a git commit via the tool)", async () => {
    const f = fakeApi()
    const checkGitDirty = mock(async (_dir: string) => true)
    const handle = runGitFooter(f.api, { checkGitDirty })
    await Bun.sleep(10)

    expect(checkGitDirty).toHaveBeenCalledTimes(1)

    f.emit("session.next.shell.ended", { properties: { output: "" } })
    await Bun.sleep(400)

    expect(checkGitDirty).toHaveBeenCalledTimes(2)

    handle.dispose()
  })

  it("refreshes when the session goes idle", async () => {
    const f = fakeApi()
    const checkGitDirty = mock(async (_dir: string) => true)
    const handle = runGitFooter(f.api, { checkGitDirty })
    await Bun.sleep(10)

    expect(checkGitDirty).toHaveBeenCalledTimes(1)

    f.emit("session.idle", {})
    await Bun.sleep(400)

    expect(checkGitDirty).toHaveBeenCalledTimes(2)

    handle.dispose()
  })

  it("registers a dispose hook with the host lifecycle", () => {
    const f = fakeApi()
    const handle = runGitFooter(f.api)

    expect(f.lifecycle).toHaveLength(1)

    handle.dispose()
  })
})
