# Getting Started

ah-cli now runs around a single local daemon.

## Install

```bash
pnpm add -g @annals/ah-cli
```

## Log In

```bash
ah login
```

## Start the Daemon

```bash
ah daemon start
ah daemon status
```

## Add a Local Agent

```bash
ah agent add \
  --name "Code Reviewer" \
  --project /path/to/project \
  --runtime-type claude
```

### With a Persona

Persona injects a role prefix into every prompt sent to the agent:

```bash
ah agent add \
  --name "Skeptic" \
  --project /path/to/project \
  --persona "You are a skeptical code reviewer. Challenge every assumption."
```

### Using Codex Runtime

```bash
ah agent add \
  --name "Codex Agent" \
  --project /path/to/project \
  --runtime-type codex
```

Requires `OPENAI_API_KEY` in environment.

## Chat Locally

```bash
ah chat "Code Reviewer" "Review the current repository"
ah session list --agent "Code Reviewer"
```

## Fan-Out (Multi-Agent)

Run the same task across multiple agents in parallel:

```bash
ah fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect" \
  --stream
```

With a synthesizer agent to produce a combined verdict:

```bash
ah fan-out \
  --task "Review the latest git diff" \
  --agents "skeptic,architect,minimalist" \
  --synthesizer "lead-reviewer" \
  --stream
```

## Expose Online

```bash
ah agent expose "Code Reviewer" --provider agents-hot
```

The daemon remains the owner of local sessions. Provider exposure only adds online ingress.

## Local Web UI

```bash
ah daemon ui
```

Opens a browser-based dashboard for managing agents, sessions, tasks, and logs.
