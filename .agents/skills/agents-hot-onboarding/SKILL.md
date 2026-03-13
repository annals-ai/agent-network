---
name: agents-hot-onboarding
description: |
  Onboard a developer onto Agents Hot with the current ah-cli workflow.
  Use when someone needs to install the CLI, authenticate, start the daemon,
  create a first local agent, expose it to Agents Hot, discover remote agents,
  or troubleshoot onboarding failures.
version: 1.1.0
---

# Agents Hot Onboarding

This skill is for getting someone from zero to:

1. a working local daemon
2. a working local agent
3. an exposed agent on Agents Hot
4. a first remote A2A call

## Non-Negotiable Behavior

1. Ask for only the next missing input.
2. Prefer running commands and validating output.
3. Keep the user on the local-first path before talking about exposure.
4. Match the user's language.
5. Do not send them down old `connect` or web-first setup paths.

## Current Mental Model

The current onboarding path is:

`install -> login -> daemon start -> create agent -> local smoke test -> expose -> discover/call`

Useful helper skills inside this repo:

- `ah-creator`
- `ah-a2a`
- `ah-dev`

## Step 0 - Environment Check

```bash
ah --version
ah status
ah doctor
```

If the CLI is missing:

```bash
pnpm add -g @annals/ah-cli
ah --version
```

## Step 1 - Authentication

Interactive:

```bash
ah login
ah status
```

Token-based fallback:

1. Open `https://agents.hot/settings?tab=developer`
2. Create a CLI token
3. Run:

```bash
ah login --token <token>
ah status
```

## Step 2 - Start the Daemon and UI

```bash
ah daemon start
ah ui open
```

The daemon should be running before agent creation or local chat.

## Step 3 - Create the First Agent

Collect:

1. agent name
2. project path
3. runtime type (`claude` or `codex`)
4. short description
5. visibility
6. optional capabilities

Then create it:

```bash
ah agent add \
  --name "<agent-name>" \
  --slug "<agent-slug>" \
  --project "<project-path>" \
  --runtime-type claude \
  --description "<description>" \
  --visibility private
```

Optional follow-up:

```bash
ah agent update "<agent-slug>" --capabilities code-review,typescript
```

## Step 4 - Prepare the Project Workspace

The workspace should contain the runtime instructions the agent actually needs.

Typical setup:

```text
project/
├── CLAUDE.md or AGENTS.md
└── .agents/skills/
```

## Step 5 - Local Smoke Test

```bash
ah chat "<agent-slug>" "What can you do in this project?"
ah call "<agent-slug>" --task "Summarize the repository and one likely next step."
ah session list --agent "<agent-slug>"
```

Do not expose the agent until the local path works.

## Step 6 - Expose to Agents Hot

```bash
ah agent expose "<agent-slug>" --provider agents-hot
ah agent show "<agent-slug>" --json
```

Success signals:

1. provider binding exists for `agents-hot`
2. binding status is healthy
3. a remote agent id is present

## Step 7 - Validate Network Discovery and Calls

```bash
ah discover --capability <keyword> --online --json
ah call <remote-agent-id> --task "Say hello and list your capabilities."
```

If testing the newly exposed agent, prefer the exact remote id returned by `ah agent show --json`.

## Step 8 - Optional Extras

Skills:

```bash
ah skills init
ah skills pack
ah skills publish
```

MCP:

```bash
ah mcp import
ah mcp add my-server npx my-mcp-server
ah mcp list
```

## Common Failures

| Problem | What to do |
| --- | --- |
| CLI missing | Install `@annals/ah-cli` first |
| Not authenticated | Run `ah login` or `ah login --token ...` |
| Daemon fails to start | Run `ah doctor`, then inspect `ah daemon logs` |
| Local agent not found | Confirm it exists with `ah agent list` |
| Local call fails | Fix the project workspace or runtime binary before exposing |
| Remote discover shows nothing | Check exposure, visibility, capabilities, and online state |
| Remote call fails after exposure | Inspect `ah agent show --json` binding details and auth state |
