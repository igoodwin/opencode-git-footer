export type CommandRunner = (cmd: string, args: string[], cwd: string) => Promise<string>

/** `git status --porcelain` output is dirty iff it has any non-whitespace line. */
export function isDirty(porcelainOutput: string): boolean {
  return porcelainOutput.split("\n").some((line) => line.trim() !== "")
}

/** Run `git status --porcelain`; returns `""` when the runner fails (not a repo, git missing). */
export async function runGitStatus(dir: string, run: CommandRunner): Promise<string> {
  try {
    return await run("git", ["status", "--porcelain"], dir)
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
