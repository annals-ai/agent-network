import type { Command } from 'commander';
import { readFileSync, watchFile, unwatchFile, statSync } from 'node:fs';
import { AgentNetworkDaemonServer } from '../daemon/server.js';
import { DaemonStore } from '../daemon/store.js';
import { getDaemonLogPath } from '../daemon/paths.js';
import {
  ensureDaemonRunning,
  getDaemonRuntimeInfo,
  getDaemonStatus,
  removeDaemonPid,
  removeDaemonSocket,
  startDaemonBackgroundWithInfo,
  stopDaemonBackground,
  writeDaemonPid,
} from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
import {
  formatUiUrlMessage,
  isInteractiveTerminal,
  maybeAutoOpenUiOnLaunch,
} from '../ui/open-browser.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, GREEN, RESET } from '../utils/table.js';

function tailLog(path: string, lines: number): string[] {
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .slice(-lines);
  } catch {
    return [];
  }
}

export function registerDaemonCommand(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Manage the local ah daemon');

  daemon
    .command('serve', { hidden: true })
    .description('Internal daemon entrypoint')
    .action(async () => {
      writeDaemonPid(process.pid);
      const server = new AgentNetworkDaemonServer();
      await server.listen();
    });

  daemon
    .command('start')
    .description('Start the local daemon')
    .option('--no-open', 'Do not open the local Web UI automatically on first launch')
    .action(async (opts: { noOpen?: boolean }) => {
      const result = await startDaemonBackgroundWithInfo();
      log.success(`Daemon running (pid ${result.pid})`);

      if (result.runtime?.uiBaseUrl) {
        console.log(`  ${formatUiUrlMessage(result.runtime.uiBaseUrl)}`);

        const store = new DaemonStore();
        try {
          const opened = await maybeAutoOpenUiOnLaunch({
            store,
            url: result.runtime.uiBaseUrl,
            interactive: isInteractiveTerminal(),
            noOpen: opts.noOpen === true,
            alreadyRunning: result.alreadyRunning,
          });

          if (opened) {
            log.info('Opened the local Web UI in your default browser.');
          }
        } finally {
          store.close();
        }
      }
    });

  daemon
    .command('stop')
    .description('Stop the local daemon')
    .action(async () => {
      const stopped = await stopDaemonBackground();
      if (stopped) {
        log.success('Daemon stopped');
      } else {
        log.info('Daemon was not running');
      }
    });

  daemon
    .command('status')
    .description('Show local daemon status')
    .option('--json', 'Output JSON')
    .action(async (opts: { json?: boolean }) => {
      const status = await getDaemonStatus();

      const result: {
        running: boolean;
        pid: number | null;
        socketPath: string;
        logPath: string;
        runtime?: {
          startedAt: string;
          uiBaseUrl: string | null;
          uiPort: number | null;
          agents: number;
          sessions: number;
          taskGroups: number;
          providerBindings: number;
          onlineBindings: number;
        };
      } = {
        running: status.running,
        pid: status.pid ?? null,
        socketPath: status.socketPath,
        logPath: status.logPath,
      };

      if (status.reachable) {
        const runtime = await requestDaemon<{
          agents: number;
          sessions: number;
          taskGroups: number;
          providerBindings: number;
          onlineBindings: number;
          startedAt: string;
          uiBaseUrl: string | null;
          uiPort: number | null;
        }>('daemon.status');

        result.runtime = {
          startedAt: runtime.startedAt,
          uiBaseUrl: runtime.uiBaseUrl,
          uiPort: runtime.uiPort,
          agents: runtime.agents,
          sessions: runtime.sessions,
          taskGroups: runtime.taskGroups,
          providerBindings: runtime.providerBindings,
          onlineBindings: runtime.onlineBindings,
        };

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log('');
        console.log(`  ${BOLD}AH Daemon${RESET}`);
        console.log('');
        console.log(`  ${GRAY}Running${RESET}    ${status.running ? `${GREEN}yes${RESET}` : 'no'}`);
        console.log(`  ${GRAY}PID${RESET}        ${status.pid ?? '—'}`);
        console.log(`  ${GRAY}Socket${RESET}     ${status.socketPath}`);
        console.log(`  ${GRAY}Log${RESET}        ${status.logPath}`);
        console.log(`  ${GRAY}Started${RESET}    ${runtime.startedAt}`);
        console.log(`  ${GRAY}Web UI${RESET}     ${runtime.uiBaseUrl ?? '—'}`);
        console.log(`  ${GRAY}UI Port${RESET}    ${runtime.uiPort ?? '—'}`);
        console.log(`  ${GRAY}Agents${RESET}     ${runtime.agents}`);
        console.log(`  ${GRAY}Sessions${RESET}   ${runtime.sessions}`);
        console.log(`  ${GRAY}Tasks${RESET}      ${runtime.taskGroups}`);
        console.log(`  ${GRAY}Bindings${RESET}   ${runtime.providerBindings}`);
        console.log(`  ${GRAY}Online${RESET}     ${runtime.onlineBindings}`);
        console.log('');
      } else {
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log('');
        console.log(`  ${BOLD}AH Daemon${RESET}`);
        console.log('');
        console.log(`  ${GRAY}Running${RESET}    ${status.running ? `${GREEN}yes${RESET}` : 'no'}`);
        console.log(`  ${GRAY}PID${RESET}        ${status.pid ?? '—'}`);
        console.log(`  ${GRAY}Socket${RESET}     ${status.socketPath}`);
        console.log(`  ${GRAY}Log${RESET}        ${status.logPath}`);
        console.log('');
        console.log(`  ${GRAY}Tip: Run 'ah daemon start' to start the daemon.${RESET}`);
        console.log('');
      }
    });

  daemon
    .command('logs')
    .description('Show daemon logs')
    .option('-n, --lines <n>', 'Lines to show', '50')
    .option('-f, --follow', 'Follow log output (tail -f style)')
    .action(async (opts: { lines: string; follow?: boolean }) => {
      await ensureDaemonRunning();
      const runtime = await getDaemonRuntimeInfo();
      if (runtime?.uiBaseUrl) {
        console.log(`  ${formatUiUrlMessage(runtime.uiBaseUrl)}`);
      }
      const logPath = getDaemonLogPath();
      const count = Number.parseInt(opts.lines, 10);
      const lines = tailLog(logPath, Number.isFinite(count) ? count : 50);
      
      if (lines.length === 0 && !opts.follow) {
        log.info('No daemon logs yet.');
        return;
      }

      // Print initial lines
      for (const line of lines) {
        console.log(line);
      }

      // If --follow flag is set, watch the file for changes
      if (opts.follow) {
        let lastSize = 0;
        try {
          lastSize = statSync(logPath).size;
        } catch {
          lastSize = 0;
        }

        console.log(`${GRAY}--- following logs (Ctrl+C to stop) ---${RESET}`);

        watchFile(logPath, { interval: 500 }, (curr) => {
          if (curr.size > lastSize) {
            // Read new content
            try {
              const fd = require('node:fs').openSync(logPath, 'r');
              const buffer = Buffer.alloc(curr.size - lastSize);
              require('node:fs').readSync(fd, buffer, 0, buffer.length, lastSize);
              require('node:fs').closeSync(fd);
              const newContent = buffer.toString('utf-8');
              const newLines = newContent.split('\n').filter((l: string) => l.length > 0);
              for (const newLine of newLines) {
                console.log(newLine);
              }
              lastSize = curr.size;
            } catch {
              // Ignore read errors
            }
          }
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          unwatchFile(logPath);
          process.exit(0);
        });

        // Keep process alive
        process.stdin.resume();
      }
    });

  daemon
    .command('cleanup', { hidden: true })
    .action(() => {
      removeDaemonPid();
      removeDaemonSocket();
    });
}
