import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { AgentMeshDaemonServer } from '../daemon/server.js';
import { getDaemonLogPath } from '../daemon/paths.js';
import {
  ensureDaemonRunning,
  getDaemonStatus,
  removeDaemonPid,
  removeDaemonSocket,
  startDaemonBackground,
  stopDaemonBackground,
  writeDaemonPid,
} from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
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
    .description('Manage the local agent-mesh daemon');

  daemon
    .command('serve', { hidden: true })
    .description('Internal daemon entrypoint')
    .action(async () => {
      writeDaemonPid(process.pid);
      const server = new AgentMeshDaemonServer();
      await server.listen();
    });

  daemon
    .command('start')
    .description('Start the local daemon')
    .action(async () => {
      const pid = await startDaemonBackground();
      log.success(`Daemon running (pid ${pid})`);
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
    .action(async () => {
      const status = await getDaemonStatus();
      console.log('');
      console.log(`  ${BOLD}Agent Mesh Daemon${RESET}`);
      console.log('');
      console.log(`  ${GRAY}Running${RESET}    ${status.running ? `${GREEN}yes${RESET}` : 'no'}`);
      console.log(`  ${GRAY}PID${RESET}        ${status.pid ?? '—'}`);
      console.log(`  ${GRAY}Socket${RESET}     ${status.socketPath}`);
      console.log(`  ${GRAY}Log${RESET}        ${status.logPath}`);

      if (status.reachable) {
        const runtime = await requestDaemon<{
          agents: number;
          sessions: number;
          taskGroups: number;
          providerBindings: number;
          onlineBindings: number;
          startedAt: string;
        }>('daemon.status');
        console.log(`  ${GRAY}Started${RESET}    ${runtime.startedAt}`);
        console.log(`  ${GRAY}Agents${RESET}     ${runtime.agents}`);
        console.log(`  ${GRAY}Sessions${RESET}   ${runtime.sessions}`);
        console.log(`  ${GRAY}Tasks${RESET}      ${runtime.taskGroups}`);
        console.log(`  ${GRAY}Bindings${RESET}   ${runtime.providerBindings}`);
        console.log(`  ${GRAY}Online${RESET}     ${runtime.onlineBindings}`);
      }

      console.log('');
    });

  daemon
    .command('logs')
    .description('Show daemon logs')
    .option('-n, --lines <n>', 'Lines to show', '50')
    .action(async (opts: { lines: string }) => {
      await ensureDaemonRunning();
      const count = Number.parseInt(opts.lines, 10);
      const lines = tailLog(getDaemonLogPath(), Number.isFinite(count) ? count : 50);
      if (lines.length === 0) {
        log.info('No daemon logs yet.');
        return;
      }
      for (const line of lines) {
        console.log(line);
      }
    });

  daemon
    .command('cleanup', { hidden: true })
    .action(() => {
      removeDaemonPid();
      removeDaemonSocket();
    });
}
