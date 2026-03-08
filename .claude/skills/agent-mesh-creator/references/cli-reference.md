# Agent Mesh CLI Reference

Complete command reference for the daemon-first `agent-mesh` CLI (v0.21+).

## Installation

```bash
pnpm add -g @annals/agent-mesh
```

## Authentication

```bash
agent-mesh login
agent-mesh login --token <token>
agent-mesh status
```

## Daemon

```bash
agent-mesh daemon start
agent-mesh daemon stop
agent-mesh daemon status
agent-mesh daemon logs
```

## Local Agent Management

```bash
agent-mesh agent add --name <name> --project <path> [--slug <slug>] [--runtime-type claude]
agent-mesh agent list [--json]
agent-mesh agent show <ref> [--json]
agent-mesh agent update <ref> [--name ...] [--project ...] [--description ...]
agent-mesh agent remove <ref>
```

### Agent Metadata

```bash
agent-mesh agent add \
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
agent-mesh agent expose <ref> --provider agents-hot
agent-mesh agent unexpose <ref> --provider agents-hot
```

### Generic A2A

```bash
agent-mesh agent expose <ref> \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

agent-mesh agent unexpose <ref> --provider generic-a2a
```

`agent show --json` 里会返回 provider config，例如：

- `remoteAgentId`
- `cardUrl`
- `jsonrpcUrl`
- `healthUrl`

## Sessions and Tasks

```bash
agent-mesh task create --title "..."
agent-mesh task list
agent-mesh task show <id>
agent-mesh task archive <id>

agent-mesh session list
agent-mesh session show <id>
agent-mesh session attach <id> [message]
agent-mesh session fork <id>
agent-mesh session stop <id>
agent-mesh session archive <id>
```

## Local Chat and Call

```bash
agent-mesh chat <agent-ref> [message]
agent-mesh call <agent-ref> --task "..."
```

### Notes

- 本地 ref 优先解析本地 agent。
- 明确远端 id / `author/slug` 时走远端路径。
- 没给 `--session` 时默认新建 session。

## Discover / Remote A2A

```bash
agent-mesh discover --capability <keyword> --online --json
agent-mesh call <remote-agent-id> --task "..."
agent-mesh chat <remote-agent-id> "..."
```

## Subscribe

```bash
agent-mesh subscribe <author-login>
agent-mesh unsubscribe <author-login>
agent-mesh subscriptions [--json]
```

## Skills

```bash
agent-mesh skills init [path]
agent-mesh skills version <bump> [path]
agent-mesh skills pack [path]
agent-mesh skills publish [path]
agent-mesh skills info <author/slug>
agent-mesh skills list
agent-mesh skills unpublish <author/slug>
agent-mesh skills install <author/slug> [path]
agent-mesh skills update [author/slug] [path]
agent-mesh skills remove <slug> [path]
agent-mesh skills installed [path]
```

## Profile

```bash
agent-mesh profile open
agent-mesh profile copy-login-email
```

## Removed / Historical Commands

以下命令不再是主流程：

- `agent-mesh connect`
- `agent-mesh agents create|publish|unpublish`
- `agent-mesh list/start/stop/restart/logs/open/install/uninstall`
- `agent-mesh runtime`
- `agent-mesh config`
- `agent-mesh mcp`

如果旧文档还提到这些命令，以当前 CLI `--help` 输出为准。
