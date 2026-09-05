import path from "node:path"

export type CommandRunner = (cmd: string, args: string[], cwd: string) => Promise<string>

/** `git status --porcelain` output is dirty iff it has any non-whitespace line. */
export function isDirty(porcelainOutput: string): boolean {
  return porcelainOutput.split("\n").some((line) => line.trim() !== "")
}

/** Run `git status --porcelain`; returns `""` when the runner fails (not a repo, git missing). */
export async function runGitStatus(dir: string, run: CommandRunner): Promise<string> {
  try {
    // --no-optional-locks stops git from refreshing .git/index (and creating
    // .git/index.lock) on a read-only status; otherwise the watcher sees the
    // lock it just created and re-triggers forever.
    return await run("git", ["--no-optional-locks", "status", "--porcelain"], dir)
  } catch {
    return ""
  }
}

/** Default runner backed by Bun.spawn. Throws on non-zero exit. */
export async function bunCommandRunner(cmd: string, args: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn([cmd, ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) throw new Error(`${cmd} exited with ${exitCode}`)
  return stdout
}

/** Convenience: is the working tree at `dir` dirty? */
export async function isGitDirty(dir: string, run: CommandRunner = bunCommandRunner): Promise<boolean> {
  return isDirty(await runGitStatus(dir, run))
}

/**
 * Resolve the actual `.git` directory for `dir` via `git rev-parse --git-dir`.
 * Handles worktrees (where `.git` is a file pointing at the real dir) and
 * returns `undefined` when `dir` is not a git repo.
 */
export async function resolveGitDir(dir: string, run: CommandRunner = bunCommandRunner): Promise<string | undefined> {
  try {
    const out = await run("git", ["rev-parse", "--git-dir"], dir)
    const gitDir = out.trim()
    if (!gitDir) return undefined
    return path.isAbsolute(gitDir) ? gitDir : path.join(dir, gitDir)
  } catch {
    return undefined
  }
}

/** Current branch in `dir` via `git rev-parse --abbrev-ref HEAD`; `undefined` on detached HEAD / failure. */
export async function gitBranch(dir: string, run: CommandRunner = bunCommandRunner): Promise<string | undefined> {
  try {
    const out = await run("git", ["--no-optional-locks", "rev-parse", "--abbrev-ref", "HEAD"], dir)
    const branch = out.trim()
    if (!branch || branch === "HEAD") return undefined
    return branch
  } catch {
    return undefined
  }
}

/**
 * True when `dir` is a linked git worktree (not the main checkout). Compares
 * `git rev-parse --git-dir` vs `--git-common-dir`; they differ only for linked
 * worktrees (and submodules, which share the same caveat as the `using-git-worktrees` skill).
 */
export async function isGitWorktree(dir: string, run: CommandRunner = bunCommandRunner): Promise<boolean> {
  try {
    const [gitDir, commonDir] = await Promise.all([
      run("git", ["rev-parse", "--git-dir"], dir),
      run("git", ["rev-parse", "--git-common-dir"], dir),
    ])
    const resolve = (p: string) => (path.isAbsolute(p) ? p : path.resolve(dir, p))
    return resolve(gitDir.trim()) !== resolve(commonDir.trim())
  } catch {
    return false
  }
}

export type GitWorktree = {
  path: string
  branch?: string
  current: boolean
}

/**
 * All git worktrees of the repo that contains `dir` (from `git worktree list --porcelain`).
 * `current` marks the worktree git reports as the checked-out HEAD.
 */
export async function listGitWorktrees(dir: string, run: CommandRunner = bunCommandRunner): Promise<GitWorktree[]> {
  try {
    const out = await run("git", ["--no-optional-locks", "worktree", "list", "--porcelain"], dir)
    const items: GitWorktree[] = []
    let current: GitWorktree | undefined
    for (const raw of out.split("\n")) {
      const line = raw.trim()
      if (line.startsWith("worktree ")) {
        current = { path: line.slice("worktree ".length).trim(), current: false }
        items.push(current)
      } else if (current && line.startsWith("branch ")) {
        current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "")
      } else if (current && line.startsWith("HEAD ")) {
        current.current = true
      }
    }
    return items
  } catch {
    return []
  }
}
