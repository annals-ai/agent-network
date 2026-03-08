import { spawn } from 'node:child_process';

type DaemonSettingsStore = {
  getDaemonSetting<T = unknown>(key: string): T | null;
  setDaemonSetting<T>(key: string, value: T): T;
};

type BrowserOpener = (url: string) => boolean;

export function formatUiUrlMessage(url: string): string {
  return `Local Web UI: ${url}`;
}

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function openBrowser(url: string): boolean {
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function shouldOpenUiOnLaunch(store: DaemonSettingsStore): Promise<boolean> {
  const setting = store.getDaemonSetting<{ value?: boolean }>('ui.first_open_completed');
  return setting?.value !== true;
}

export function markUiFirstOpenCompleted(store: DaemonSettingsStore): void {
  store.setDaemonSetting('ui.first_open_completed', {
    value: true,
    completedAt: new Date().toISOString(),
  });
}

export async function maybeAutoOpenUiOnLaunch(options: {
  store: DaemonSettingsStore;
  url: string;
  interactive: boolean;
  noOpen: boolean;
  alreadyRunning: boolean;
  opener?: BrowserOpener;
}): Promise<boolean> {
  if (options.noOpen || options.alreadyRunning || !options.interactive) {
    return false;
  }

  if (!await shouldOpenUiOnLaunch(options.store)) {
    return false;
  }

  const opener = options.opener ?? openBrowser;
  const opened = opener(options.url);
  if (opened) {
    markUiFirstOpenCompleted(options.store);
  }
  return opened;
}

export function forceOpenUi(url: string, opener: BrowserOpener = openBrowser): boolean {
  return opener(url);
}
