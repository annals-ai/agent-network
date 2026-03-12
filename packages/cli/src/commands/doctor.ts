import type { Command } from 'commander';
import { existsSync, accessSync, constants, unlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getDaemonStatus, startDaemonBackground } from '../daemon/process.js';
import { requestDaemon } from '../daemon/client.js';
import { hasToken, loadToken, saveToken } from '../platform/auth.js';
import { loadConfig, saveConfig, getConfigPath, getLogsDir, getPidsDir } from '../utils/config.js';
import { log } from '../utils/logger.js';
import { BOLD, GRAY, GREEN, RED, YELLOW, RESET, CYAN } from '../utils/table.js';
import { execSync } from 'node:child_process';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose common issues with ah CLI setup')
    .option('--json', 'Output JSON')
    .option('--fix', 'Automatically fix detected issues')
    .action(async (opts: { json?: boolean; fix?: boolean }) => {
      const results: CheckResult[] = [];

      // Check 1: Config file exists and is valid
      const configPath = getConfigPath();
      try {
        const config = loadConfig();
        results.push({
          name: 'Config',
          status: 'ok',
          message: `Valid config at ${configPath}`,
        });
        
        // Check agents count
        const agentCount = Object.keys(config.agents || {}).length;
        if (agentCount === 0) {
          results.push({
            name: 'Agents',
            status: 'warn',
            message: 'No agents configured',
            detail: 'Run "ah agent add --name <name> --project <path>" to add an agent',
          });
        }
      } catch (err) {
        if (existsSync(configPath)) {
          results.push({
            name: 'Config',
            status: 'error',
            message: 'Config file exists but is invalid JSON',
            detail: configPath,
          });
        } else {
          results.push({
            name: 'Config',
            status: 'warn',
            message: 'No config file found (will be created on first use)',
            detail: configPath,
          });
        }
      }

      // Check 2: Directories are writable
      const logsDir = getLogsDir();
      const pidsDir = getPidsDir();
      
      try {
        accessSync(logsDir, constants.W_OK);
        results.push({ name: 'Logs dir', status: 'ok', message: `Writable: ${logsDir}` });
      } catch {
        results.push({ name: 'Logs dir', status: 'error', message: `Not writable: ${logsDir}` });
      }

      try {
        accessSync(pidsDir, constants.W_OK);
        results.push({ name: 'PIDs dir', status: 'ok', message: `Writable: ${pidsDir}` });
      } catch {
        results.push({ name: 'PIDs dir', status: 'error', message: `Not writable: ${pidsDir}` });
      }

      // Check 3: Daemon status
      const daemonStatus = await getDaemonStatus();
      if (daemonStatus.running && daemonStatus.reachable) {
        results.push({
          name: 'Daemon',
          status: 'ok',
          message: `Running (PID ${daemonStatus.pid})`,
        });

        // Check runtime info
        try {
          const runtime = await requestDaemon<{
            agents: number;
            sessions: number;
            taskGroups: number;
          }>('daemon.status');
          results.push({
            name: 'Runtime',
            status: 'ok',
            message: `${runtime.agents} agents, ${runtime.sessions} sessions, ${runtime.taskGroups} tasks`,
          });
        } catch {
          results.push({
            name: 'Runtime',
            status: 'warn',
            message: 'Could not fetch runtime info',
          });
        }
      } else if (daemonStatus.running && !daemonStatus.reachable) {
        results.push({
          name: 'Daemon',
          status: 'error',
          message: 'Running but not reachable (socket issue?)',
          detail: `Socket: ${daemonStatus.socketPath}`,
        });
      } else {
        results.push({
          name: 'Daemon',
          status: 'warn',
          message: 'Not running',
          detail: 'Run "ah daemon start" to start the daemon',
        });
      }

      // Check 4: Authentication
      if (hasToken()) {
        const token = loadToken()!;
        results.push({
          name: 'Auth',
          status: 'ok',
          message: `Logged in (token: ${token.slice(0, 8)}...${token.slice(-4)})`,
        });
      } else {
        results.push({
          name: 'Auth',
          status: 'warn',
          message: 'Not logged in',
          detail: 'Run "ah login" to enable provider sync/expose features',
        });
      }

      // Check 5: Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
      if (majorVersion >= 20) {
        results.push({
          name: 'Node.js',
          status: 'ok',
          message: `${nodeVersion} (recommended: 20+)`,
        });
      } else {
        results.push({
          name: 'Node.js',
          status: 'warn',
          message: `${nodeVersion} (recommended: 20+)`,
          detail: 'Some features may not work correctly on older Node.js versions',
        });
      }

      // Output results
      if (opts.json) {
        console.log(JSON.stringify({
          checks: results,
          summary: {
            ok: results.filter(r => r.status === 'ok').length,
            warn: results.filter(r => r.status === 'warn').length,
            error: results.filter(r => r.status === 'error').length,
          },
        }, null, 2));
        return;
      }

      console.log(`\n${BOLD}${CYAN}AH Doctor - Diagnostics${RESET}\n`);

      for (const result of results) {
        const icon = result.status === 'ok' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
        const statusColor = result.status === 'ok' ? GREEN : result.status === 'warn' ? YELLOW : RED;
        console.log(`  ${icon}  ${BOLD}${result.name}:${RESET} ${statusColor}${result.message}${RESET}`);
        if (result.detail) {
          console.log(`      ${GRAY}${result.detail}${RESET}`);
        }
      }

      // Summary
      const okCount = results.filter(r => r.status === 'ok').length;
      const warnCount = results.filter(r => r.status === 'warn').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      console.log('');
      if (errorCount > 0) {
        console.log(`  ${RED}${BOLD}Found ${errorCount} error(s)${RESET} that need attention.`);
      } else if (warnCount > 0) {
        console.log(`  ${YELLOW}${warnCount} warning(s)${RESET}. All systems operational.`);
      } else {
        console.log(`  ${GREEN}All systems healthy!${RESET}`);
      }

      // Auto-fix mode: actually fix issues
      if (opts.fix && (errorCount > 0 || warnCount > 0)) {
        console.log(`\n  ${BOLD}${YELLOW}Auto-fixing issues...${RESET}\n`);

        for (const result of results) {
          if (result.status === 'ok') continue;

          const icon = result.status === 'error' ? '❌' : '⚠️';
          let fixed = false;

          // Fix: Config file invalid
          if (result.name === 'Config' && result.status === 'error' && result.message.includes('invalid JSON')) {
            try {
              unlinkSync(getConfigPath());
              saveConfig({ agents: {} });
              console.log(`  ${icon} ${result.name}: ${GREEN}Reset config file${RESET}`);
              fixed = true;
            } catch {
              console.log(`  ${icon} ${result.name}: ${RED}Failed to reset config${RESET}`);
            }
          }

          // Fix: No config file (just create default)
          if (result.name === 'Config' && result.status === 'warn' && result.message.includes('No config file')) {
            try {
              saveConfig({ agents: {} });
              console.log(`  ${icon} ${result.name}: ${GREEN}Created default config${RESET}`);
              fixed = true;
            } catch {
              console.log(`  ${icon} ${result.name}: ${RED}Failed to create config${RESET}`);
            }
          }

          // Fix: Logs/PIDs directory not writable - try to create/fix
          if ((result.name === 'Logs dir' || result.name === 'PIDs dir') && result.status === 'error') {
            try {
              const dir = result.name === 'Logs dir' ? getLogsDir() : getPidsDir();
              if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true, mode: 0o755 });
              } else {
                // Try to fix permissions
                execSync(`chmod 755 "${dir}"`, { stdio: 'ignore' });
              }
              console.log(`  ${icon} ${result.name}: ${GREEN}Fixed directory permissions${RESET}`);
              fixed = true;
            } catch {
              console.log(`  ${icon} ${result.name}: ${RED}Failed to fix directory${RESET}`);
            }
          }

          // Fix: Daemon not running - start it
          if (result.name === 'Daemon' && result.status === 'warn' && result.message === 'Not running') {
            try {
              await startDaemonBackground();
              // Wait a bit for daemon to start
              await new Promise(resolve => setTimeout(resolve, 1500));
              console.log(`  ${icon} ${result.name}: ${GREEN}Started daemon${RESET}`);
              fixed = true;
            } catch {
              console.log(`  ${icon} ${result.name}: ${RED}Failed to start daemon${RESET}`);
            }
          }

          // Info messages (cannot auto-fix)
          if (!fixed && result.name === 'Auth' && result.status === 'warn') {
            console.log(`  ${icon} ${result.name}: ${YELLOW}Run "ah login" to authenticate${RESET}`);
          }
          if (!fixed && result.name === 'Agents' && result.status === 'warn') {
            console.log(`  ${icon} ${result.name}: ${YELLOW}Run "ah agent add" to add agents${RESET}`);
          }
          if (!fixed && result.name === 'Node.js' && result.status === 'warn') {
            console.log(`  ${icon} ${result.name}: ${YELLOW}Upgrade Node.js to 20+${RESET}`);
          }
        }

        console.log('');

        // Re-run checks after fixes
        console.log(`  ${BOLD}Re-checking after fixes...${RESET}\n`);

        // Re-check daemon status
        const newDaemonStatus = await getDaemonStatus();
        const newResults: CheckResult[] = [];

        // Check config again
        try {
          loadConfig();
          newResults.push({ name: 'Config', status: 'ok', message: 'Config file valid' });
        } catch {
          newResults.push({ name: 'Config', status: 'error', message: 'Config still invalid' });
        }

        // Check daemon
        if (newDaemonStatus.running && newDaemonStatus.reachable) {
          newResults.push({ name: 'Daemon', status: 'ok', message: `Running (PID ${newDaemonStatus.pid})` });
        } else if (newDaemonStatus.running) {
          newResults.push({ name: 'Daemon', status: 'error', message: 'Running but not reachable' });
        } else {
          newResults.push({ name: 'Daemon', status: 'warn', message: 'Not running' });
        }

        // Check directories
        try {
          accessSync(getLogsDir(), constants.W_OK);
          newResults.push({ name: 'Logs dir', status: 'ok', message: 'Writable' });
        } catch {
          newResults.push({ name: 'Logs dir', status: 'error', message: 'Not writable' });
        }

        try {
          accessSync(getPidsDir(), constants.W_OK);
          newResults.push({ name: 'PIDs dir', status: 'ok', message: 'Writable' });
        } catch {
          newResults.push({ name: 'PIDs dir', status: 'error', message: 'Not writable' });
        }

        for (const result of newResults) {
          const icon = result.status === 'ok' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
          const statusColor = result.status === 'ok' ? GREEN : result.status === 'warn' ? YELLOW : RED;
          console.log(`  ${icon}  ${BOLD}${result.name}:${RESET} ${statusColor}${result.message}${RESET}`);
        }

        const newOk = newResults.filter(r => r.status === 'ok').length;
        const newError = newResults.filter(r => r.status === 'error').length;
        console.log('');
        if (newError > 0) {
          console.log(`  ${RED}${BOLD}Still have ${newError} issue(s) that could not be auto-fixed.${RESET}`);
        } else {
          console.log(`  ${GREEN}${BOLD}All fixable issues resolved!${RESET}`);
        }
        console.log('');
      }
    });
}