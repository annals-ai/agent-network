import type { Command } from 'commander';
import { ensureDaemonRunning } from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, RESET } from '../utils/table.js';
import { parseTagFlags, runLocalChat } from './local-runtime.js';

export function registerSessionCommand(program: Command): void {
  const session = program
    .command('session')
    .description('Inspect and manage local sessions');

  session
    .command('list')
    .description('List local sessions')
    .option('--agent <ref>', 'Filter by agent')
    .option('--task-group <id>', 'Filter by task group')
    .option('--status <status>', 'queued|active|idle|paused|completed|failed|archived|all', 'all')
    .option('--json', 'Output JSON')
    .action(async (opts: { agent?: string; taskGroup?: string; status: string; json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ sessions: Array<Record<string, unknown>> }>('session.list', {
        agentRef: opts.agent,
        taskGroupId: opts.taskGroup,
        status: opts.status,
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(JSON.stringify(result.sessions, null, 2));
    });

  session
    .command('show <id>')
    .description('Show one session and its messages')
    .option('--json', 'Output JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon('session.show', { id });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(JSON.stringify(result, null, 2));
    });

  session
    .command('attach <id> [message]')
    .description('Attach to an existing local session; send a message when provided')
    .option('--json', 'Output JSON')
    .action(async (id: string, message: string | undefined, opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      if (!message) {
        const result = await requestDaemon('session.attach', { id });
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      await runLocalChat({
        sessionId: id,
        message,
        json: opts.json,
      });
    });

  session
    .command('fork <id>')
    .description('Fork a session into a new local branch session')
    .option('--task-group <id>', 'Bind the new session to a task group')
    .option('--title <title>', 'Title for the new session')
    .option('--tag <tag...>', 'Add tags to the forked session')
    .action(async (id: string, opts: { taskGroup?: string; title?: string; tag?: string[] }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ session: { id: string; title: string | null } }>('session.fork', {
        id,
        taskGroupId: opts.taskGroup,
        title: opts.title,
        tags: parseTagFlags(opts.tag),
      });
      log.success(`Forked session: ${BOLD}${result.session.title || result.session.id}${RESET}`);
      console.log(`  ${GRAY}${result.session.id}${RESET}`);
    });

  session
    .command('stop <id>')
    .description('Stop the active work for a session')
    .action(async (id: string) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ session: { status: string } }>('session.stop', { id });
      log.success(`Session updated: ${result.session.status}`);
    });

  session
    .command('archive <id>')
    .description('Archive a session')
    .action(async (id: string) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ session: { id: string; status: string } }>('session.archive', { id });
      log.success(`Session archived: ${result.session.id}`);
      console.log(`  ${GRAY}status${RESET} ${result.session.status}`);
    });
}
