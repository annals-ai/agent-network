import type { Command } from 'commander';
import { ensureDaemonRunning } from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, RESET } from '../utils/table.js';

export function registerTaskCommand(program: Command): void {
  const task = program
    .command('task')
    .description('Manage task groups that organize many sessions');

  task
    .command('create')
    .description('Create a task group')
    .requiredOption('--title <title>', 'Task group title')
    .option('--source <source>', 'Source label', 'cli')
    .action(async (opts: { title: string; source: string }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ taskGroup: { id: string; title: string } }>('task.create', {
        title: opts.title,
        source: opts.source,
      });
      log.success(`Task group created: ${BOLD}${result.taskGroup.title}${RESET}`);
      console.log(`  ${GRAY}${result.taskGroup.id}${RESET}`);
    });

  task
    .command('list')
    .description('List task groups')
    .option('--json', 'Output JSON')
    .action(async (opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ taskGroups: Array<Record<string, unknown>> }>('task.list');
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      if (result.taskGroups.length === 0) {
        log.info('No task groups yet.');
        return;
      }
      console.log(JSON.stringify(result.taskGroups, null, 2));
    });

  task
    .command('show <id>')
    .description('Show one task group with its sessions')
    .option('--json', 'Output JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ taskGroup: Record<string, unknown>; sessions: Array<Record<string, unknown>> }>('task.show', { id });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`\n${BOLD}${String(result.taskGroup.title ?? id)}${RESET}`);
      console.log(`${GRAY}${id}${RESET}\n`);
      console.log(JSON.stringify(result.sessions, null, 2));
    });

  task
    .command('archive <id>')
    .description('Archive a task group')
    .action(async (id: string) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ taskGroup: { title: string } }>('task.archive', { id });
      log.success(`Task group archived: ${result.taskGroup.title}`);
    });
}
