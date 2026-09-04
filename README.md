# opencode-git-footer

OpenCode TUI plugin that replaces the sidebar footer with a path + git branch
indicator, marking the branch dirty (via `git status --porcelain`) with a
colored dot, plus the app version and a dismissible "getting started" banner.

## Install

1. `bun install && bun run build`
2. Add the plugin to `~/.config/opencode/tui.json`:

```jsonc
{
  "plugin": ["/home/mukminov/src/opencode-git-footer"]
}
```

3. Restart OpenCode.

The spec must be a `file:///` URL (or an absolute path) so the TUI host imports
the package directory directly.

## Development

```bash
bun install
bun run verify   # bun test && tsc --noEmit
bun run build    # bun build tui.ts + .d.ts into dist/
```

Layout: `src/git-status.ts` (pure `git status` runner), `src/tui-footer.tsx`
(footer component + `describeBranch`/`abbreviateHome`), `src/git-footer.ts`
(TUI glue: dirty signal + polling), `tui.ts` (TUI module entry).

## Donate

Support the project with crypto (Ethereum / ERC-20):

```text
ETH: YOUR_ETH_ADDRESS
```

> TODO: replace `YOUR_ETH_ADDRESS` with your wallet address once you've created one.

## License

MIT — see `LICENSE`.
