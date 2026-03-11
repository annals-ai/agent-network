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

export interface AhMcpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpConfig {
  mcpServers?: Record<string, AhMcpServer>;
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
  const config = loadConfig() as BridgeConfig & McpConfig;

  // Merge MCP servers
  const existingMcpServers = config.mcpServers || {};

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
  const config = loadConfig() as BridgeConfig & McpConfig;
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
  const config = loadConfig() as BridgeConfig & McpConfig;
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

async function addMcpServer(
  name: string,
  command: string,
  args: string[] = [],
  options: { env?: Record<string, string>; disabled?: boolean } = {}
): Promise<void> {
  // Validate server name
  if (!name || name.trim() === '') {
    outputError('invalid_name', 'Server name is required');
    return;
  }

  // Validate command
  if (!command || command.trim() === '') {
    outputError('invalid_command', 'Command is required');
    return;
  }

  const config = loadConfig() as BridgeConfig & McpConfig;
  const mcpServers = config.mcpServers || {};

  // Check if server already exists
  if (mcpServers[name]) {
    slogWarn(`MCP server "${name}" already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  // Build the server config
  const serverConfig: AhMcpServer = {
    command: command.trim(),
    args: args.map(a => a.trim()),
  };

  if (options.env && Object.keys(options.env).length > 0) {
    serverConfig.env = options.env;
  }

  if (options.disabled) {
    serverConfig.disabled = true;
  }

  // Add to config
  mcpServers[name] = serverConfig;
  config.mcpServers = mcpServers;
  saveConfig(config);

  const status = options.disabled ? ' (disabled)' : '';
  slogSuccess(`Added MCP server "${name}": ${command} ${args.join(' ')}${status}`);
  process.stderr.write(`\nConfig saved to: ${getConfigPath()}\n`);
}

// --- Registration ---

export function registerMcpCommand(program: Command): void {
  const mcpCmd = program
    .command('mcp')
    .description('Manage MCP servers');

  mcpCmd
    .command('add <name> <command> [args...]')
    .description('Add an MCP server')
    .option('-e, --env <key=value>', 'Environment variable (can be repeated, e.g., -e API_KEY=xxx -e NODE_ENV=prod)', (value: string, prev: string[] = []) => prev.concat(value))
    .option('--disabled', 'Add the server but keep it disabled')
    .option('--force', 'Overwrite existing MCP server with the same name')
    .action(async (name: string, command: string, args: string[], opts: { env?: string[]; disabled?: boolean; force?: boolean }) => {
      try {
        // Parse env variables
        let env: Record<string, string> | undefined;
        if (opts.env && opts.env.length > 0) {
          env = {};
          for (const e of opts.env) {
            const [key, ...valueParts] = e.split('=');
            if (!key || valueParts.length === 0) {
              outputError('invalid_env', `Invalid env format: ${e}. Expected KEY=VALUE`);
              return;
            }
            env[key] = valueParts.join('=');
          }
        }

        // Handle --force by removing existing server first
        if (opts.force) {
          const config = loadConfig() as BridgeConfig & McpConfig;
          if (config.mcpServers?.[name]) {
            delete config.mcpServers[name];
            saveConfig(config);
          }
        }

        await addMcpServer(name, command, args, { env, disabled: opts.disabled });
      } catch (err) {
        outputError('add_failed', err instanceof Error ? err.message : String(err));
      }
    });

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