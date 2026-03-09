# Agent Network

[![npm version](https://img.shields.io/npm/v/@annals/agent-network.svg)](https://www.npmjs.com/package/@annals/agent-network)
[![npm downloads](https://img.shields.io/npm/dm/@annals/agent-network.svg)](https://www.npmjs.com/package/@annals/agent-network)
[![license](https://img.shields.io/github/license/annals-ai/agent-network.svg)](./LICENSE)

[English](./README.md) | [中文](./README.zh-CN.md)

Agent Network is now a daemon-first local runtime for managing many agents and many sessions on one machine, with optional provider exposure such as Agents Hot. It also ships a local Web UI, started by the daemon, so owners can inspect transcripts, tasks, exposure state, and logs without pushing full history to the platform.

## Install

```bash
pnpm add -g @annals/agent-network
```

## Quickstart

```bash
agent-network login
agent-network daemon start
agent-network ui open
agent-network agent add --name "Code Reviewer" --project /path/to/project --runtime-type claude
agent-network chat "Code Reviewer" "Review this repo"
agent-network agent expose "Code Reviewer" --provider agents-hot
agent-network agent expose "Code Reviewer" --provider generic-a2a --config-json '{"port":4123,"bearerToken":"replace-me"}'
```

## Core Model

- One local daemon per machine
- Many local agents
- Many sessions per agent
- Task groups to organize related work
- Optional provider bindings for online ingress
- A local Web UI for transcript, task, provider, and log inspection

The daemon owns local state in SQLite. Full transcript history stays local to the daemon and is surfaced through the local Web UI. Local `chat` and `call` go through the daemon first. Exposed providers forward traffic into the same session core instead of bypassing it. Agents Hot is the gateway, discovery, and auth layer; it is not the long-term transcript surface.

## Local History Surface

- `agent-network daemon start` starts both the daemon and the local Web UI backend
- `agent-network ui open` opens the current local Web UI in your browser
- `agent-network ui serve` ensures the daemon-backed Web UI is running and prints the URL
- On the first successful interactive daemon launch, Agent Network opens the Web UI automatically
- Electron or Tauri can wrap this local Web UI later, but that is not part of v1

## Main Commands

```bash
agent-network login
agent-network status

agent-network daemon start|stop|status|logs
agent-network ui serve|open

agent-network agent add --name --project [--sandbox]
agent-network agent list
agent-network agent show <ref>
agent-network agent update <ref>
agent-network agent remove <ref>
agent-network agent expose <ref> --provider agents-hot|generic-a2a [--config-json '{}']
agent-network agent unexpose <ref> --provider agents-hot|generic-a2a

agent-network task create --title "..."
agent-network task list
agent-network task show <id>
agent-network task archive <id>

agent-network session list
agent-network session show <id>
agent-network session attach <id> [message]
agent-network session fork <id>
agent-network session stop <id>
agent-network session archive <id>

agent-network chat <agent> [message]
agent-network call <agent> --task "..."
agent-network discover --capability <keyword>
agent-network skills ...
agent-network subscribe ...
agent-network profile ...
```

## Sandbox

Sandbox is now explicit and optional.

- Without sandbox: the agent works directly inside `--project`
- With sandbox: Agent Network creates an isolated workspace and enables file-oriented flows

Session ownership does not depend on sandbox mode.

## Provider Examples

```bash
# Agents Hot ingress
agent-network agent expose "Code Reviewer" --provider agents-hot

# Generic A2A ingress on a local HTTP port
agent-network agent expose "Code Reviewer" \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

# Inspect generated URLs
agent-network agent show "Code Reviewer" --json
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Repository Layout

```txt
agent-network/
├── packages/
│   ├── cli/       # daemon-first CLI
│   ├── ui/        # local Web UI workspace
│   ├── protocol/  # bridge protocol types
│   └── worker/    # bridge worker / durable objects
├── tests/
└── CLAUDE.md
```
