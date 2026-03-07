import { spawn } from 'node:child_process';
import {
  openSync,
  closeSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { getDaemonLogPath, getDaemonPidPath, getDaemonSocketPath, ensureDaemonDirs } from './paths.js';
import { isDaemonReachable } from './client.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readDaemonPid(): number | null {
  try {
    const raw = readFileSync(getDaemonPidPath(), 'utf-8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function writeDaemonPid(pid: number): void {
  writeFileSync(getDaemonPidPath(), `${pid}\n`, { mode: 0o600 });
}

export function removeDaemonPid(): void {
  try {
    unlinkSync(getDaemonPidPath());
  } catch {}
}

export function removeDaemonSocket(): void {
  try {
    unlinkSync(getDaemonSocketPath());
  } catch {}
}

export async function startDaemonBackground(): Promise<number> {
  ensureDaemonDirs();

  const existingPid = readDaemonPid();
  if (existingPid && isProcessAlive(existingPid) && await isDaemonReachable()) {
    return existingPid;
  }

  if (existingPid && !isProcessAlive(existingPid)) {
    removeDaemonPid();
  }

  removeDaemonSocket();

  const logFd = openSync(getDaemonLogPath(), 'a', 0o600);
  const child = spawn(process.execPath, [process.argv[1], 'daemon', 'serve'], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  child.unref();
  closeSync(logFd);

  writeDaemonPid(child.pid!);
  await waitForDaemonReady();
  return child.pid!;
}

export async function ensureDaemonRunning(): Promise<number> {
  const pid = readDaemonPid();
  if (pid && isProcessAlive(pid) && await isDaemonReachable()) {
    return pid;
  }

  return startDaemonBackground();
}

export async function stopDaemonBackground(): Promise<boolean> {
  const pid = readDaemonPid();
  if (!pid) {
    removeDaemonSocket();
    return false;
  }

  if (!isProcessAlive(pid)) {
    removeDaemonPid();
    removeDaemonSocket();
    return false;
  }

  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(100);
    if (!isProcessAlive(pid)) {
      removeDaemonPid();
      removeDaemonSocket();
      return true;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {}

  removeDaemonPid();
  removeDaemonSocket();
  return true;
}

export async function waitForDaemonReady(timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isDaemonReachable()) {
      return;
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for agent-mesh daemon to start.');
}

export async function getDaemonStatus(): Promise<{
  running: boolean;
  pid: number | null;
  socketPath: string;
  logPath: string;
  reachable: boolean;
}> {
  const pid = readDaemonPid();
  const reachable = await isDaemonReachable();
  return {
    running: !!pid && isProcessAlive(pid) && reachable,
    pid,
    socketPath: getDaemonSocketPath(),
    logPath: getDaemonLogPath(),
    reachable,
  };
}
