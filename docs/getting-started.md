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

### With a Persona

Persona injects a role prefix into every prompt sent to the agent:

```bash
agent-mesh agent add \
  --name "Skeptic" \
  --project /path/to/project \
  --persona "You are a skeptical code reviewer. Challenge every assumption."
```

### Using Codex Runtime

```bash
agent-mesh agent add \
  --name "Codex Agent" \
  --project /path/to/project \
  --runtime-type codex
```

Requires `OPENAI_API_KEY` in environment.

## Chat Locally

```bash
agent-mesh chat "Code Reviewer" "Review the current repository"
agent-mesh session list --agent "Code Reviewer"
```

## Fan-Out (Multi-Agent)

Run the same task across multiple agents in parallel:

```bash
agent-mesh fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect" \
  --stream
```

With a synthesizer agent to produce a combined verdict:

```bash
agent-mesh fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect,minimalist" \
  --synthesizer "lead-reviewer" \
  --stream
```

## Expose Online

```bash
agent-mesh agent expose "Code Reviewer" --provider agents-hot
```

The daemon remains the owner of local sessions. Provider exposure only adds online ingress.

## Local Web UI

```bash
agent-mesh daemon ui
```

Opens a browser-based dashboard for managing agents, sessions, tasks, and logs.
