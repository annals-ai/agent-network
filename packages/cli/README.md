# @annals/agent-mesh

Daemon-first CLI for managing local AI agents and optionally exposing them to Agents Hot.

## Install

```bash
pnpm add -g @annals/agent-mesh
```

## Quickstart

```bash
agent-mesh login
agent-mesh daemon start
agent-mesh agent add --name "My Agent" --project /path/to/project
agent-mesh chat "My Agent" "Review this repo"
agent-mesh agent expose "My Agent" --provider agents-hot
```

## Command Surface

```bash
agent-mesh login
agent-mesh status

agent-mesh daemon start|stop|status|logs

agent-mesh agent add|list|show|update|remove
agent-mesh agent expose|unexpose

agent-mesh task create|list|show|archive
agent-mesh session list|show|attach|fork|stop|archive

agent-mesh chat <agent> [message]
agent-mesh call <agent> --task "..."
agent-mesh discover
agent-mesh skills ...
agent-mesh subscribe ...
agent-mesh profile ...
```
