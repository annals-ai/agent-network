import type { Command } from 'commander';
import { ensureDaemonRunning } from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
import { listProviders } from '../providers/index.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, RESET } from '../utils/table.js';

function parseCapabilities(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseJsonConfig(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function registerAgentCommand(program: Command): void {
  const agent = program
    .command('agent')
    .description('Manage local daemon-owned agents');

  agent
    .command('add')
    .description('Register a local agent')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--project <path>', 'Project directory for the agent')
    .option('--slug <slug>', 'Local slug')
    .option('--runtime-type <type>', 'Runtime type', 'claude')
    .option('--sandbox', 'Enable sandbox/workspace isolation for this agent')
    .option('--description <text>', 'Description')
    .option('--visibility <visibility>', 'public | private | unlisted', 'private')
    .option('--capabilities <caps>', 'Comma-separated capabilities')
    .action(async (opts: {
      name: string;
      project: string;
      slug?: string;
      runtimeType: string;
      sandbox?: boolean;
      description?: string;
      visibility: 'public' | 'private' | 'unlisted';
      capabilities?: string;
    }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ agent: { id: string; slug: string; name: string } }>('agent.add', {
        name: opts.name,
        slug: opts.slug,
        runtimeType: opts.runtimeType,
        projectPath: opts.project,
        sandbox: opts.sandbox === true,
        description: opts.description,
        visibility: opts.visibility,
        capabilities: parseCapabilities(opts.capabilities),
      });
      log.success(`Local agent added: ${BOLD}${result.agent.name}${RESET} (${result.agent.slug})`);
    });

  agent
    .command('list')
    .description('List local agents')
    .option('--json', 'Output JSON')
    .action(async (opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{
        agents: Array<{
          id: string;
          slug: string;
          name: string;
          runtimeType: string;
          projectPath: string;
          sandbox: boolean;
          visibility: string;
        }>;
        bindings: Array<{ agentId: string; provider: string; status: string }>;
      }>('agent.list');

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.agents.length === 0) {
        log.info('No local agents registered.');
        return;
      }

      console.log('');
      console.log(`  ${BOLD}Local Agents${RESET}`);
      console.log('');
      for (const item of result.agents) {
        const bindings = result.bindings.filter((binding) => binding.agentId === item.id);
        console.log(`  ${BOLD}${item.slug}${RESET}  ${GRAY}${item.runtimeType}${RESET}`);
        console.log(`     ${item.name}`);
        console.log(`     ${GRAY}${item.projectPath}${RESET}`);
        console.log(`     sandbox=${item.sandbox ? 'on' : 'off'} visibility=${item.visibility}`);
        if (bindings.length) {
          console.log(`     ${GRAY}providers:${RESET} ${bindings.map((binding) => `${binding.provider}(${binding.status})`).join(', ')}`);
        }
      }
      console.log('');
    });

  agent
    .command('show <ref>')
    .description('Show one local agent')
    .option('--json', 'Output JSON')
    .action(async (ref: string, opts: { json?: boolean }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{
        agent: Record<string, unknown>;
        bindings: Array<Record<string, unknown>>;
      }>('agent.get', { ref });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(JSON.stringify(result, null, 2));
    });

  agent
    .command('update <ref>')
    .description('Update a local agent')
    .option('--name <name>', 'Agent name')
    .option('--slug <slug>', 'Local slug')
    .option('--runtime-type <type>', 'Runtime type')
    .option('--project <path>', 'Project directory')
    .option('--sandbox', 'Enable sandbox')
    .option('--no-sandbox', 'Disable sandbox')
    .option('--description <text>', 'Description')
    .option('--visibility <visibility>', 'public | private | unlisted')
    .option('--capabilities <caps>', 'Comma-separated capabilities')
    .action(async (ref: string, opts: {
      name?: string;
      slug?: string;
      runtimeType?: string;
      project?: string;
      sandbox?: boolean;
      description?: string;
      visibility?: 'public' | 'private' | 'unlisted';
      capabilities?: string;
    }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ agent: { slug: string; name: string } }>('agent.update', {
        ref,
        name: opts.name,
        slug: opts.slug,
        runtimeType: opts.runtimeType,
        projectPath: opts.project,
        sandbox: typeof opts.sandbox === 'boolean' ? opts.sandbox : undefined,
        description: opts.description,
        visibility: opts.visibility,
        capabilities: parseCapabilities(opts.capabilities),
      });
      log.success(`Local agent updated: ${BOLD}${result.agent.name}${RESET} (${result.agent.slug})`);
    });

  agent
    .command('remove <ref>')
    .description('Remove a local agent')
    .action(async (ref: string) => {
      await ensureDaemonRunning();
      await requestDaemon('agent.remove', { ref });
      log.success(`Local agent removed: ${ref}`);
    });

  agent
    .command('expose <ref>')
    .description(`Expose a local agent through a provider (${listProviders().join(', ')})`)
    .requiredOption('--provider <provider>', 'Provider name')
    .option('--config-json <json>', 'Provider-specific JSON config')
    .action(async (ref: string, opts: { provider: string; configJson?: string }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{
        agent: { slug: string };
        binding: { provider: string; status: string; remoteAgentId?: string | null };
      }>('agent.expose', {
        ref,
        provider: opts.provider,
        config: parseJsonConfig(opts.configJson),
      });
      log.success(`Agent exposed via ${result.binding.provider}`);
      if (result.binding.remoteAgentId) {
        console.log(`  ${GRAY}remote id${RESET} ${result.binding.remoteAgentId}`);
      }
      console.log(`  ${GRAY}status${RESET}    ${result.binding.status}`);
    });

  agent
    .command('unexpose <ref>')
    .description('Disable a provider exposure for a local agent')
    .requiredOption('--provider <provider>', 'Provider name')
    .action(async (ref: string, opts: { provider: string }) => {
      await ensureDaemonRunning();
      const result = await requestDaemon<{ binding: { provider: string; status: string } }>('agent.unexpose', {
        ref,
        provider: opts.provider,
      });
      log.success(`Agent exposure updated: ${result.binding.provider} -> ${result.binding.status}`);
    });
}
