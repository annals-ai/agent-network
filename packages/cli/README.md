# @annals/agent-network

Daemon-first CLI for managing local AI agents and optionally exposing them to Agents Hot.

## Install

```bash
pnpm add -g @annals/agent-network
```

## Quickstart

```bash
agent-network login
agent-network daemon start
agent-network agent add --name "My Agent" --project /path/to/project
agent-network chat "My Agent" "Review this repo"
agent-network agent expose "My Agent" --provider agents-hot
```

## Command Surface

```bash
agent-network login
agent-network status

agent-network daemon start|stop|status|logs

agent-network agent add|list|show|update|remove
agent-network agent expose|unexpose

agent-network task create|list|show|archive
agent-network session list|show|attach|fork|stop|archive

agent-network chat <agent> [message]
agent-network call <agent> --task "..."
agent-network discover
agent-network skills ...
agent-network subscribe ...
agent-network profile ...
```
