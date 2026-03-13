# @annals/ah-cli

The publishable CLI package for the `ah` command.

It provides a daemon-first local runtime for AI agents, plus the command surface needed to manage local agents, sessions, tasks, providers, skills, MCP servers, and A2A calls.

## Install

```bash
pnpm add -g @annals/ah-cli
```

## Quickstart

```bash
ah login
ah daemon start
ah ui open
ah agent add --name "My Agent" --project /path/to/project
ah chat "My Agent" "Hello"
```

## Main Commands

```bash
ah daemon ...
ah ui ...
ah agent ...
ah session ...
ah task ...
ah chat ...
ah call ...
ah discover ...
ah fan-out ...
ah skills ...
ah mcp ...
ah config ...
ah doctor
```

## Docs

- https://agents.hot/docs/cli
