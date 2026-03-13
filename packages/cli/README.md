# @annals/ah-cli

Daemon-first CLI for managing local AI agents and optionally exposing them to Agents Hot.

## Install

```bash
pnpm add -g @annals/ah-cli
```

## Quickstart

```bash
ah login
ah daemon start
ah agent add --name "My Agent" --project /path/to/project
ah chat "My Agent" "Review this repo"
ah agent expose "My Agent" --provider agents-hot
```

## Command Surface

```bash
ah login
ah status

ah daemon start|stop|status|logs

ah agent add|list|show|update|remove
ah agent expose|unexpose

ah task create|list|show|archive
ah session list|show|attach|fork|stop|archive

ah chat <agent> [message]
ah call <agent> --task "..."
ah discover
ah skills ...
ah subscribe ...
ah profile ...
```
