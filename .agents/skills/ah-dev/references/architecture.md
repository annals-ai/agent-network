# ah-cli Architecture

## Overview

`ah-cli` is a local-runtime product with four major packages:

1. `packages/cli`
2. `packages/ui`
3. `packages/protocol`
4. `packages/worker`

The daemon-first model is the center of everything.

## Local Runtime Layer

`packages/cli` owns:

- daemon lifecycle
- agent registry
- session lifecycle
- task-group lifecycle
- provider bindings
- runtime profile dispatch
- local Web UI backend
- local persistence

Important consequence:

The daemon is the primary owner of local sessions and transcripts.

## UI Layer

`packages/ui` plus `packages/cli/src/ui` provide the local browser surface for:

- sessions
- messages
- tasks
- agents
- provider binding state
- logs and runtime status

This is a local control surface, not the public marketplace UI.

## Provider Layer

Two current provider directions matter:

### `agents-hot`

- exposes a local agent to the hosted platform
- uses the Bridge Worker path
- makes the agent discoverable and callable on the network

### `generic-a2a`

- starts a local standard A2A ingress
- serves agent card and JSON-RPC endpoints
- forwards requests into the daemon runtime

## Worker Layer

`packages/worker` handles:

- platform ingress
- bridge WebSocket coordination
- relay HTTP endpoints
- A2A forwarding between platform and connected runtimes
- WebRTC signaling relay for file transfer

## Protocol Layer

`packages/protocol` defines the bridge message contracts between:

- CLI runtime
- Bridge Worker
- relay HTTP paths

This package is small but high impact. If you change these types, you must audit all producers and consumers.

## Main Runtime Flows

### Local execution

```text
ah command -> daemon client -> daemon runtime -> runtime profile -> local session store
```

### Hosted provider execution

```text
platform request -> worker bridge -> daemon provider binding -> runtime profile -> local session store
```

### Generic A2A execution

```text
remote A2A client -> local HTTP ingress -> daemon runtime -> local session store
```

## Storage Ownership

The local daemon is the system of record for:

- local agents
- local sessions
- local session messages
- local task groups
- provider bindings

The hosted platform keeps discovery, access, ratings, and remote-facing session/task indexes, but it is not the canonical transcript owner for daemon-backed local work.

## Runtime Profiles

Runtime profile logic lives in:

- `packages/cli/src/adapters/profiles.ts`

Current real built-in profiles:

- `claude`
- `codex`

If you add or widen runtime support, check:

1. CLI profile registry
2. daemon runtime dispatch
3. protocol message assumptions
4. docs and help text

## Common Failure Modes

1. Changing a command without updating the skill/docs layer
2. Updating provider behavior without testing local-first resolution
3. Changing protocol types without updating worker and bridge manager together
4. Treating platform state as the only source of truth for local runtime data

## Related Main-Repo Integration

`ah-cli` integrates with the main Agents Hot repo for:

- marketplace discovery
- chat/call HTTP entrypoints
- A2A 1.0 compatibility endpoints
- developer session sync paths

When behavior crosses the repo boundary, inspect both codebases before locking in the final design.
