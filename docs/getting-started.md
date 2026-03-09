# Getting Started

Agent Network now runs around a single local daemon.

## Install

```bash
pnpm add -g @annals/agent-network
```

## Log In

```bash
agent-network login
```

## Start the Daemon

```bash
agent-network daemon start
agent-network daemon status
```

## Add a Local Agent

```bash
agent-network agent add \
  --name "Code Reviewer" \
  --project /path/to/project \
  --runtime-type claude
```

### With a Persona

Persona injects a role prefix into every prompt sent to the agent:

```bash
agent-network agent add \
  --name "Skeptic" \
  --project /path/to/project \
  --persona "You are a skeptical code reviewer. Challenge every assumption."
```

### Using Codex Runtime

```bash
agent-network agent add \
  --name "Codex Agent" \
  --project /path/to/project \
  --runtime-type codex
```

Requires `OPENAI_API_KEY` in environment.

## Chat Locally

```bash
agent-network chat "Code Reviewer" "Review the current repository"
agent-network session list --agent "Code Reviewer"
```

## Fan-Out (Multi-Agent)

Run the same task across multiple agents in parallel:

```bash
agent-network fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect" \
  --stream
```

With a synthesizer agent to produce a combined verdict:

```bash
agent-network fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect,minimalist" \
  --synthesizer "lead-reviewer" \
  --stream
```

## Expose Online

```bash
agent-network agent expose "Code Reviewer" --provider agents-hot
```

The daemon remains the owner of local sessions. Provider exposure only adds online ingress.

## Local Web UI

```bash
agent-network daemon ui
```

Opens a browser-based dashboard for managing agents, sessions, tasks, and logs.
