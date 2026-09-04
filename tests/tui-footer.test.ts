import { describe, it, expect, mock } from "bun:test"
import { describeBranch, abbreviateHome, registerFooterSlot } from "../src/tui-footer"

describe("describeBranch", () => {
  it("returns undefined when there is no branch", () => {
    expect(describeBranch(undefined, false)).toBeUndefined()
  })

  it("marks main/master as default", () => {
    expect(describeBranch("master", false)).toEqual({ name: "master", dirty: false, isDefault: true })
  })

  it("reports the dirty flag for a feature branch", () => {
    expect(describeBranch("feature/x", true)).toEqual({ name: "feature/x", dirty: true, isDefault: false })
  })
})

describe("abbreviateHome", () => {
  it("shortens the home directory to ~", () => {
    expect(abbreviateHome("/home/alice/projects/x", "/home/alice")).toBe("~/projects/x")
  })

  it("shortens the home directory itself", () => {
    expect(abbreviateHome("/home/alice", "/home/alice")).toBe("~")
  })

  it("leaves paths outside home untouched", () => {
    expect(abbreviateHome("/opt/app", "/home/alice")).toBe("/opt/app")
  })
})

describe("registerFooterSlot", () => {
  it("registers sidebar_footer with an order below the builtin 100", () => {
    const registered: Array<{ order?: number; slots?: Record<string, unknown> }> = []
    const api = {
      slots: { register: mock((plugin: unknown) => registered.push(plugin as never)) },
    } as any

    registerFooterSlot(api, () => false)

    expect(registered).toHaveLength(1)
    expect(registered[0].order).toBeLessThan(100)
    expect(typeof registered[0].slots?.sidebar_footer).toBe("function")
  })
})
