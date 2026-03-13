---
name: ah-dev
description: |
  Development guide for the ah-cli sub-repo. Use when modifying the CLI,
  daemon runtime, local Web UI, worker bridge, provider ingress, runtime
  profiles, or protocol packages inside ah-cli.
version: 0.1.0
---

# ah-cli Development Guide

## Read This First

Start with:

1. `ah-cli/CLAUDE.md`
2. the relevant package directory
3. the small reference files in this skill

Do not design against old `connect` or `connect-ticket` assumptions.

## Repo Shape

```text
ah-cli/
├── packages/
│   ├── cli/
│   ├── ui/
│   ├── protocol/
│   └── worker/
├── tests/
├── README.md
└── CLAUDE.md
```

## Current Product Truths

1. `packages/cli/` is the local daemon runtime and command surface.
2. `packages/ui/` is the local Web UI, not a public hosted control plane.
3. `packages/worker/` is the Bridge Worker for provider traffic.
4. `packages/protocol/` owns the bridge message contracts.
5. Providers connect the daemon to the outside world:
   - `agents-hot`
   - `generic-a2a`

## Routing by Change Type

### Daemon or local runtime

Look in:

- `packages/cli/src/daemon/`
- `packages/cli/src/providers/`
- `packages/cli/src/commands/`
- `packages/cli/src/adapters/`

### Local Web UI

Look in:

- `packages/ui/`
- `packages/cli/src/ui/`

### Bridge Worker

Look in:

- `packages/worker/src/`
- `packages/protocol/src/`

### Runtime profiles

Look in:

- `packages/cli/src/adapters/profiles.ts`
- `packages/cli/src/daemon/runtime.ts`
- `packages/protocol/src/messages.ts`

If you widen runtime support, audit the protocol too. Some bridge-level types still assume older runtime shapes.

### External A2A behavior

If the change affects actual A2A 1.0 semantics, also inspect the main repo:

- `/Users/kcsx/Project/kcsx/agents-hot/src/lib/a2a/`
- `/Users/kcsx/Project/kcsx/agents-hot/src/app/api/a2a/`

`ah-cli` is only one part of the end-to-end A2A system.

## Development Workflow

```bash
cd /Users/kcsx/Project/kcsx/agents-hot/ah-cli
pnpm install
pnpm build
pnpm exec vitest run
```

Useful targeted commands:

```bash
pnpm -C /Users/kcsx/Project/kcsx/agents-hot/ah-cli build
pnpm -C /Users/kcsx/Project/kcsx/agents-hot/ah-cli exec vitest run
pnpm -C /Users/kcsx/Project/kcsx/agents-hot/ah-cli lint
```

Treat lint debt carefully. Distinguish pre-existing failures from regressions introduced by your change.

## Integration Checks

If you touched CLI behavior, verify with real commands:

```bash
node packages/cli/dist/index.js help --json
ah daemon start
ah agent list
ah chat <local-agent> "hello"
```

If you touched provider or bridge behavior, also verify:

1. local daemon path
2. provider exposure path
3. network path or remote smoke test

## Deployment Notes

### CLI package

- npm package name: `@annals/ah-cli`
- executable: `ah`

### Mac Mini runtime

Remote runtime path currently lives under:

```text
/Users/yan/agents-hot/ah-cli
```

If the user asks to update the remote runtime, use the `macmini` skill from the main repo context.

## References

- `references/architecture.md`
- `references/protocol-reference.md`
- `../ah-creator/references/cli-reference.md`
