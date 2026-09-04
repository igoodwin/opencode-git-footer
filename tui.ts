import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { runGitFooter } from "./src/git-footer"

export { runGitFooter } from "./src/git-footer"

const tui: TuiPlugin = async (api) => {
  runGitFooter(api)
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-git-footer",
  tui,
}

export default plugin
