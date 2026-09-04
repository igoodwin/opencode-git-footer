# Git branch dirty indicator (TUI sidebar footer) — design

## Goal

Replicate the fork's `feat(tui): add git branch status indicator` change
(`cecf5c8a66`) as a **plugin**: color a `●` dot after the branch name in the
sidebar footer — orange (`theme().warning`) when the working tree is dirty,
green (`theme().success`) when clean.

## Why a plugin, not the fork

The fork reads `api.state.vcs.dirty`, but that field is **absent** in the
released `@opencode-ai/plugin` SDK (`TuiState.vcs` only declares `branch` and
`default_branch`) and the released server's `vcs.branch.updated` event only
carries `branch`. So the plugin must compute dirty itself via
`git status --porcelain`.

## How the footer slot works

`sidebar_footer` is `mode="single_winner"` (packages/tui/src/routes/session/sidebar.tsx:90).
`@opentui/core` sorts slot registrations by `order` ascending and the first
entry wins. The built-in `internal:sidebar-footer` registers at `order: 100`,
so a plugin registering `sidebar_footer` with `order < 100` fully replaces it.

**Consequence:** the plugin owns the whole footer and must reproduce everything
the built-in renders, not just the branch dot.

## Components

### `src/git-status.ts` (pure, testable)

- `isDirty(porcelainOutput: string): boolean` — `true` iff the trimmed output of
  `git status --porcelain` is non-empty.
- `runGitStatus(dir: string, run: (cmd: string, args: string[], cwd: string) => Promise<string>): Promise<string>`
  — runs `git status --porcelain` in `dir` via an injected runner (test seam).
  Returns `""` on non-zero exit (not a repo / error) so the UI falls back to
  "clean".

### `src/tui-footer.tsx`

- `registerFooterSlot(api, dirty: () => boolean)` — registers `sidebar_footer`
  with `order: 50`.
- Renders the full footer, faithful to the built-in:
  - "Getting started" box (shown only when there are no paid providers and the
    `dismissed_getting_started` kv flag is unset) — uses `api.state.provider`
    and `api.kv`, same logic as the fork.
  - `parent/name:branch ●` — parent muted, name text, dot colored by dirty.
  - `• OpenCode <version>` line via `api.app.version`.
- Branch name from `api.state.vcs.branch` (present in released SDK); path from
  `session.directory` or `api.state.path.directory`, abbreviated with `~` for
  the home dir.

### `src/tui-plugin.ts`

- Create a `dirty` solid signal.
- Refresh `dirty` on: init, and on events `vcs.branch.updated`, `file.edited`,
  `command.executed`, `file.watcher.updated` (debounced), plus a low-frequency
  interval fallback (10 s) to catch external edits.
- Register the footer slot, passing the signal as an accessor.

## Error handling

- Not a git repo / `git` missing / `git status` fails → `runGitStatus` returns
  `""` → dot renders green (clean). No toasts, no noise.
- Debounce rapid event bursts; never run concurrent `git status` calls (last
  writer wins via a monotonically increasing token).

## Testing

- `isDirty`: empty output → false; whitespace-only → false; any line → true.
- `runGitStatus`: forwards args/cwd to the injected runner; maps non-zero exit
  to `""`.
- Footer slot: registration has `order < 100` and a `sidebar_footer` function.
- Glue: dirty signal updates after a `file.edited` event (using the existing
  `fakeApi` harness pattern from `tests/tui-plugin.test.ts`).
