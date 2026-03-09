import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DaemonStore } from '../../packages/cli/src/daemon/store.js';
import {
  forceOpenUi,
  formatUiUrlMessage,
  maybeAutoOpenUiOnLaunch,
  shouldOpenUiOnLaunch,
} from '../../packages/cli/src/ui/open-browser.js';

describe('local UI open behavior', () => {
  let tempDir: string;
  let store: DaemonStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-network-ui-open-'));
    store = new DaemonStore(join(tempDir, 'state.db'));
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('opens the browser only on first successful daemon start', async () => {
    const opener = vi.fn(() => true);

    expect(formatUiUrlMessage('http://127.0.0.1:4848')).toContain('http://127.0.0.1:4848');
    expect(await shouldOpenUiOnLaunch(store)).toBe(true);

    const firstOpen = await maybeAutoOpenUiOnLaunch({
      store,
      url: 'http://127.0.0.1:4848',
      interactive: true,
      noOpen: false,
      alreadyRunning: false,
      opener,
    });

    const secondOpen = await maybeAutoOpenUiOnLaunch({
      store,
      url: 'http://127.0.0.1:4848',
      interactive: true,
      noOpen: false,
      alreadyRunning: false,
      opener,
    });

    expect(firstOpen).toBe(true);
    expect(secondOpen).toBe(false);
    expect(opener).toHaveBeenCalledTimes(1);
    expect(await shouldOpenUiOnLaunch(store)).toBe(false);
  });

  it('skips auto-open when disabled or when the daemon is already running', async () => {
    const opener = vi.fn(() => true);

    const noOpen = await maybeAutoOpenUiOnLaunch({
      store,
      url: 'http://127.0.0.1:4848',
      interactive: true,
      noOpen: true,
      alreadyRunning: false,
      opener,
    });

    const alreadyRunning = await maybeAutoOpenUiOnLaunch({
      store,
      url: 'http://127.0.0.1:4848',
      interactive: true,
      noOpen: false,
      alreadyRunning: true,
      opener,
    });

    expect(noOpen).toBe(false);
    expect(alreadyRunning).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });

  it('forces browser open through the explicit ui open flow', () => {
    const opener = vi.fn(() => true);
    const opened = forceOpenUi('http://127.0.0.1:4848', opener);

    expect(opened).toBe(true);
    expect(opener).toHaveBeenCalledWith('http://127.0.0.1:4848');
  });
});
