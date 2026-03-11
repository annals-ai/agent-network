import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig, saveConfig, getConfigPath, type BridgeConfig } from '../utils/config.js';

// --- Types ---

interface VSCodeMcpConfig {
  mcpServers?: Record<string, VSCodeMcpServer>;
}

interface VSCodeMcpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

interface AhMcpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

// --- Helpers ---

const VSCODE_MCP_PATH = join(homedir(), '.vscode', 'mcp.json');

function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function outputError(error: string, message: string): never {
  console.log(JSON.stringify({ success: false, error, message }));
  process.exit(1);
}

function slogInfo(msg: string): void {
  process.stderr.write(`\x1b[34mINFO\x1b[0m  ${msg}\n`);
}

function slogSuccess(msg: string): void {
  process.stderr.write(`\x1b[32mOK\x1b[0m    ${msg}\n`);
}

function slogWarn(msg: string): void {
  process.stderr.write(`\x1b[33mWARN\x1b[0m  ${msg}\n`);
}

async function readVSCodeMcpConfig(): Promise<VSCodeMcpConfig | null> {
  try {
    const content = await readFile(VSCODE_MCP_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function convertToAhMcpServers(vscodeConfig: VSCodeMcpConfig): Record<string, AhMcpServer> {
  const result: Record<string, AhMcpServer> = {};

  if (!vscodeConfig.mcpServers) {
    return result;
  }

  for (const [name, server] of Object.entries(vscodeConfig.mcpServers)) {
    result[name] = {
      command: server.command,
      args: server.args || [],
      env: server.env,
      disabled: server.disabled,
    };
  }

  return result;
}

function displayMcpServers(servers: Record<string, AhMcpServer>): void {
  if (Object.keys(servers).length === 0) {
    slogWarn('No MCP servers found in VS Code config');
    return;
  }

  slogInfo(`Found ${Object.keys(servers).length} MCP server(s) in VS Code config:\n`);

  for (const [name, server] of Object.entries(servers)) {
    const status = server.disabled ? '(disabled)' : '';
    const envStr = server.env ? ` with custom env` : '';
    process.stderr.write(`  • ${name}: ${server.command} ${server.args.join(' ')} ${status} ${envStr}\n`);
  }
  process.stderr.write('\n');
}

// --- Commands ---

async function importMcpServers(force: boolean = false): Promise<void> {
  const vscodeConfig = await readVSCodeMcpConfig();

  if (!vscodeConfig || !vscodeConfig.mcpServers || Object.keys(vscodeConfig.mcpServers).length === 0) {
    outputError('no_config', `No VS Code MCP config found at ${VSCODE_MCP_PATH}`);
    return;
  }

  const mcpServers = convertToAhMcpServers(vscodeConfig);
  displayMcpServers(mcpServers);

  // Load existing ah config
  const config = loadConfig();

  // Merge MCP servers
  const existingMcpServers = (config as BridgeConfig & { mcpServers?: Record<string, AhMcpServer> }).mcpServers || {};

  let merged: Record<string, AhMcpServer>;
  let imported = 0;
  let skipped = 0;

  if (force) {
    // With --force, replace all existing servers with imported ones
    merged = { ...existingMcpServers, ...mcpServers };
    imported = Object.keys(mcpServers).length;
  } else {
    // Without --force, only add new servers that don't exist
    merged = { ...existingMcpServers };
    for (const [name, server] of Object.entries(mcpServers)) {
      if (!merged[name]) {
        merged[name] = server;
        imported++;
      } else {
        skipped++;
      }
    }
  }

  // Save the merged config
  const newConfig = {
    ...config,
    mcpServers: merged,
  };

  saveConfig(newConfig);

  const messages = [`Imported ${imported} MCP server(s)`];
  if (skipped > 0) {
    messages.push(`(${skipped} skipped - already exist, use --force to overwrite)`);
  }
  slogSuccess(messages.join(' '));
  process.stderr.write(`\nConfig saved to: ${getConfigPath()}\n`);
}

async function listMcpServers(): Promise<void> {
  const config = loadConfig() as BridgeConfig & { mcpServers?: Record<string, AhMcpServer> };
  const mcpServers = config.mcpServers || {};

  if (Object.keys(mcpServers).length === 0) {
    slogWarn('No MCP servers configured. Run "ah mcp import" to import from VS Code.');
    return;
  }

  slogInfo(`Configured MCP servers (${Object.keys(mcpServers).length}):\n`);

  for (const [name, server] of Object.entries(mcpServers)) {
    const status = server.disabled ? 'disabled' : 'enabled';
    process.stderr.write(`  • ${name}: ${server.command} ${server.args.join(' ')} [${status}]\n`);
  }
}

async function removeMcpServer(name: string): Promise<void> {
  const config = loadConfig() as BridgeConfig & { mcpServers?: Record<string, AhMcpServer> };
  const mcpServers = config.mcpServers || {};

  if (!mcpServers[name]) {
    outputError('not_found', `MCP server "${name}" not found`);
    return;
  }

  delete mcpServers[name];
  config.mcpServers = mcpServers;
  saveConfig(config);

  slogSuccess(`Removed MCP server "${name}"`);
}

// --- Registration ---

export function registerMcpCommand(program: Command): void {
  const mcpCmd = program
    .command('mcp')
    .description('Manage MCP servers');

  mcpCmd
    .command('import')
    .description('Import MCP servers from ~/.vscode/mcp.json')
    .option('--force', 'Overwrite existing MCP servers with the same name')
    .action(async (opts: { force?: boolean }) => {
      try {
        await importMcpServers(opts.force ?? false);
      } catch (err) {
        outputError('import_failed', err instanceof Error ? err.message : String(err));
      }
    });

  mcpCmd
    .command('list')
    .description('List configured MCP servers')
    .action(async () => {
      try {
        await listMcpServers();
      } catch (err) {
        outputError('list_failed', err instanceof Error ? err.message : String(err));
      }
    });

  mcpCmd
    .command('remove <name>')
    .description('Remove an MCP server by name')
    .action(async (name: string) => {
      try {
        await removeMcpServer(name);
      } catch (err) {
        outputError('remove_failed', err instanceof Error ? err.message : String(err));
      }
    });
}