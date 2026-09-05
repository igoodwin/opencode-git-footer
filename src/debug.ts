import { appendFileSync } from "node:fs"

const raw = process.env.OPENCODE_GIT_FOOTER_DEBUG
const enabled = raw !== undefined && raw !== "" && raw !== "0" && raw !== "false"
const logPath =
  typeof raw === "string" && raw !== "" && raw !== "1" && raw !== "true" ? raw : "/tmp/opencode-git-footer.log"

function fmt(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function debugLog(...args: unknown[]): void {
  if (!enabled) return
  const line = `${new Date().toISOString()} ${args.map(fmt).join(" ")}`
  try {
    appendFileSync(logPath, line + "\n")
  } catch {
    // never let logging break the plugin
  }
}
