import { watch } from "node:fs"

/**
 * Watch the `.git/HEAD` and `.git/index` files for changes and invoke `onChange`
 * when either one is touched. Watching the directory (rather than each file) is
 * more robust because git replaces `index` and `HEAD` atomically via rename.
 *
 * Returns a disposer; on platforms/filesystems where watching is unavailable the
 * disposer is a no-op.
 */
export function watchGitFiles(gitDir: string, onChange: () => void): () => void {
  const targets = new Set(["HEAD", "index"])
  let watcher: ReturnType<typeof watch> | null = null
  try {
    watcher = watch(gitDir, (_event, filename) => {
      if (typeof filename === "string" && targets.has(filename)) onChange()
    })
  } catch {
    return () => {}
  }
  return () => {
    watcher?.close()
    watcher = null
  }
}
