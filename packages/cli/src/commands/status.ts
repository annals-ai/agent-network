import type { Command } from 'commander';
import { hasToken, loadToken } from '../platform/auth.js';
import { requestDaemon } from '../daemon/client.js';
import { getDaemonStatus } from '../daemon/process.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, GREEN, RESET, YELLOW } from '../utils/table.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show daemon, local agent, and auth status')
    .action(async () => {
      log.banner('Agent Network Status');

      const daemon = await getDaemonStatus();
      console.log(`Daemon: ${daemon.running ? `${GREEN}running${RESET}` : `${YELLOW}stopped${RESET}`}`);
      console.log(`Socket: ${daemon.socketPath}`);
      console.log(`Log:    ${daemon.logPath}`);

      if (daemon.reachable) {
        const runtime = await requestDaemon<{
          agents: number;
          sessions: number;
          taskGroups: number;
          startedAt: string;
        }>('daemon.status');

        const agentListing = await requestDaemon<{
          agents: Array<{ id: string }>;
          bindings: Array<{ status: string }>;
        }>('agent.list');

        const activeBindings = agentListing.bindings.filter((binding) => binding.status !== 'inactive').length;
        console.log(`Started: ${runtime.startedAt}`);
        console.log(`Agents:  ${runtime.agents}`);
        console.log(`Tasks:   ${runtime.taskGroups}`);
        console.log(`Sessions:${runtime.sessions}`);
        console.log(`Expose:  ${activeBindings}`);
      }

      if (!hasToken()) {
        console.log('Auth:   not logged in');
        console.log('');
        console.log('Run `agent-network login` to enable provider sync/expose.');
        return;
      }

      const token = loadToken()!;
      const maskedToken = token.slice(0, 8) + '...' + token.slice(-4);
      console.log(`Auth:   logged in (${maskedToken})`);
      console.log('');
      console.log(`  ${BOLD}Primary Flow${RESET}`);
      console.log(`  ${GRAY}1.${RESET} agent-network daemon start`);
      console.log(`  ${GRAY}2.${RESET} agent-network agent add --name ... --project ...`);
      console.log(`  ${GRAY}3.${RESET} agent-network chat <local-agent> "..."`);
      console.log(`  ${GRAY}4.${RESET} agent-network agent expose <local-agent> --provider agents-hot`);
    });
}
