import type { Command } from 'commander';
import { ensureDaemonRunningWithInfo } from '../daemon/process.js';
import { forceOpenUi, formatUiUrlMessage } from '../ui/open-browser.js';
import { log } from '../utils/logger.js';

function requireUiUrl(url: string | null | undefined): string {
  if (!url) {
    throw new Error('Local Web UI URL is unavailable. Start the daemon again.');
  }
  return url;
}

export function registerUiCommand(program: Command): void {
  const ui = program
    .command('ui')
    .description('Manage the local agent-mesh Web UI');

  ui
    .command('serve')
    .description('Ensure the local Web UI backend is running and print its URL')
    .action(async () => {
      const result = await ensureDaemonRunningWithInfo();
      const url = requireUiUrl(result.runtime?.uiBaseUrl);
      log.success(`Daemon running (pid ${result.pid})`);
      console.log(`  ${formatUiUrlMessage(url)}`);
    });

  ui
    .command('open')
    .description('Open the local Web UI in your default browser')
    .action(async () => {
      const result = await ensureDaemonRunningWithInfo();
      const url = requireUiUrl(result.runtime?.uiBaseUrl);
      log.success(`Daemon running (pid ${result.pid})`);
      console.log(`  ${formatUiUrlMessage(url)}`);

      if (!forceOpenUi(url)) {
        console.log(`  Open this URL manually: ${url}`);
      }
    });
}
