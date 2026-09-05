# opencode-git-footer

Плагин для OpenCode TUI, который заменяет футер сайдбара индикатором
«путь + git-ветка», отмечая несохранённые изменения (через
`git status --porcelain`) цветной точкой, плюс версия приложения и
закрываемый баннер «getting started».

## Установка

### Из npm

1. Добавьте плагин в `~/.config/opencode/tui.json`:

```jsonc
{
  "plugin": ["opencode-git-footer"]
}
```

2. Перезапустите OpenCode. Пакет и его зависимости устанавливаются
   автоматически при запуске и кэшируются в `~/.cache/opencode/node_modules/`.

### Из исходников

1. `bun install && bun run build`
2. Добавьте плагин в `~/.config/opencode/tui.json`:

```jsonc
{
  "plugin": ["/home/mukminov/src/opencode-git-footer"]
}
```

3. Перезапустите OpenCode.

Спек должен быть `file:///` URL (или абсолютным путём), чтобы TUI-хост
импортировал каталог пакета напрямую.

## Разработка

```bash
bun install
bun run verify   # bun test && tsc --noEmit
bun run build    # bun build tui.ts + .d.ts в dist/
```

Структура: `src/git-status.ts` (запуск `git status`), `src/tui-footer.tsx`
(компонент футера + `describeBranch`/`abbreviateHome`), `src/git-footer.ts`
(обвязка TUI: сигнал изменений + опрос), `tui.ts` (точка входа TUI-модуля).

## Donate

Поддержать проект криптовалютой:

| BNB Smart Chain (BSC) | Tron |
| --- | --- |
| ![BNB Smart Chain](assets/donate-bsc.svg) | ![Tron](assets/donate-tron.svg) |
| `0x1Df93A331CF8D5bE9d382B6d55fe227D6489B2a2` | `TDfatR9JWqcfx5VuTMHDLQP3BN6f8Ynk5r` |

## License

MIT — см. `LICENSE`.
