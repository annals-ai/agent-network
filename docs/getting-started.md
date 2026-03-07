# Getting Started

Agent Mesh now runs around a single local daemon.

## Install

```bash
pnpm add -g @annals/agent-mesh
```

## Log In

```bash
agent-mesh login
```

## Start the Daemon

```bash
agent-mesh daemon start
agent-mesh daemon status
```

## Add a Local Agent

```bash
agent-mesh agent add \
  --name "Code Reviewer" \
  --project /path/to/project \
  --runtime-type claude
```

## Chat Locally

```bash
agent-mesh chat "Code Reviewer" "Review the current repository"
agent-mesh session list --agent "Code Reviewer"
```

## Expose Online

```bash
agent-mesh agent expose "Code Reviewer" --provider agents-hot
```

The daemon remains the owner of local sessions. Provider exposure only adds online ingress.
