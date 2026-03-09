# Agent Network CLI Reference

Complete command reference for the daemon-first `agent-network` CLI (v0.21+).

## Installation

```bash
pnpm add -g @annals/agent-network
```

## Authentication

```bash
agent-network login
agent-network login --token <token>
agent-network status
```

## Daemon

```bash
agent-network daemon start
agent-network daemon stop
agent-network daemon status
agent-network daemon logs
```

## Local Agent Management

```bash
agent-network agent add --name <name> --project <path> [--slug <slug>] [--runtime-type claude]
agent-network agent list [--json]
agent-network agent show <ref> [--json]
agent-network agent update <ref> [--name ...] [--project ...] [--description ...]
agent-network agent remove <ref>
```

### Agent Metadata

```bash
agent-network agent add \
  --name "Code Reviewer" \
  --slug code-reviewer \
  --project /path/to/project \
  --description "Reviews TypeScript repos" \
  --visibility private \
  --capabilities code-review,typescript
```

## Provider Exposure

### Agents Hot

```bash
agent-network agent expose <ref> --provider agents-hot
agent-network agent unexpose <ref> --provider agents-hot
```

### Generic A2A

```bash
agent-network agent expose <ref> \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

agent-network agent unexpose <ref> --provider generic-a2a
```

`agent show --json` 里会返回 provider config，例如：

- `remoteAgentId`
- `cardUrl`
- `jsonrpcUrl`
- `healthUrl`

## Sessions and Tasks

```bash
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
```

## Local Chat and Call

```bash
agent-network chat <agent-ref> [message]
agent-network call <agent-ref> --task "..."
```

### Notes

- 本地 ref 优先解析本地 agent。
- 明确远端 id / `author/slug` 时走远端路径。
- 没给 `--session` 时默认新建 session。

## Discover / Remote A2A

```bash
agent-network discover --capability <keyword> --online --json
agent-network call <remote-agent-id> --task "..."
agent-network chat <remote-agent-id> "..."
```

## Subscribe

```bash
agent-network subscribe <author-login>
agent-network unsubscribe <author-login>
agent-network subscriptions [--json]
```

## Skills

```bash
agent-network skills init [path]
agent-network skills version <bump> [path]
agent-network skills pack [path]
agent-network skills publish [path]
agent-network skills info <author/slug>
agent-network skills list
agent-network skills unpublish <author/slug>
agent-network skills install <author/slug> [path]
agent-network skills update [author/slug] [path]
agent-network skills remove <slug> [path]
agent-network skills installed [path]
```

## Profile

```bash
agent-network profile open
agent-network profile copy-login-email
```

## Removed / Historical Commands

以下命令不再是主流程：

- `agent-network connect`
- `agent-network agents create|publish|unpublish`
- `agent-network list/start/stop/restart/logs/open/install/uninstall`
- `agent-network runtime`
- `agent-network config`
- `agent-network mcp`

如果旧文档还提到这些命令，以当前 CLI `--help` 输出为准。
