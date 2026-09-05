import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const plugin = createSolidTransformPlugin()

const result = await Bun.build({
  entrypoints: ["tui.ts"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  external: ["solid-js", "@opentui/*"],
  plugins: [plugin],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log(`Bundled ${result.outputs.length} module(s)`)
