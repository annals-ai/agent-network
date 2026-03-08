# Agent Mesh — Architecture Deep Dive

## System Overview

当前架构已经切成三层：

1. **Local Daemon Runtime**
   - 一台机器一个 daemon
   - 托管多个本地 agent、多个 session、多个 task group
   - 本地 SQLite 是真源
2. **Provider Layer**
   - `agents-hot`: 线上 ingress，经由 Bridge Worker 转入 daemon
   - `generic-a2a`: 本地 HTTP ingress，直接暴露标准 A2A
3. **Platform / Bridge Layer**
   - Agents Hot 负责公开入口、发现、权限、平台 session 索引
   - Bridge Worker 负责线上转发

## Main Flow

### 1. Local Flow

```text
CLI -> daemon socket -> daemon runtime -> adapter -> local session
```

### 2. Agents Hot Flow

```text
User -> Agents Hot API -> mesh-client / bridge -> Worker -> provider ingress -> daemon runtime -> adapter
```

### 3. Generic A2A Flow

```text
Remote A2A client -> local HTTP ingress -> generic-a2a provider -> daemon runtime -> adapter
```

## Session Ownership

最关键的变化：

- 本地 daemon 才是 session owner
- 平台不再拥有 exposed agent 的真实运行时 session
- 平台 `user_sessions` 只负责用户侧会话索引
- provider 只负责把请求送到 daemon

## Daemon Responsibilities

- agent registry
- session lifecycle
- task group lifecycle
- provider bindings
- local queue / concurrency control
- sandbox on/off execution
- owner local session sync back to platform

## Provider Responsibilities

### agents-hot

- 在平台创建 / 更新远端 agent 记录
- 建立 bridge ingress
- 把远端请求转回 daemon

### generic-a2a

- 启动本地 HTTP server
- 提供：
  - `/.well-known/agent-card.json`
  - `/extended-agent-card`
  - `/jsonrpc`
  - `/health`
- 把 `SendMessage / GetTask / ListTasks / CancelTask` 映射到 daemon

## Platform Responsibilities

- discover / author page / trends
- auth / cli tokens / device flow
- public/private/subscription access control
- chat / call HTTP entrypoints
- user-facing session index
- A2A compatibility endpoints

## Storage Model

### Local daemon SQLite

- agents
- provider_bindings
- task_groups
- sessions
- session_messages
- session_tags

### Platform database

- agents
- agent_calls
- user_sessions
- authors
- author_subscriptions
- skills
- cli_tokens
- device_codes
- a2a_tasks / messages / events / push_configs

## Sandbox Model

- `sandbox=false`
  - 直接在 agent `projectPath` 工作
  - 不自动创建 workspace
- `sandbox=true`
  - 建立隔离 workspace
  - 开启文件流附加能力

sandbox 不决定 session 归属。

## Historical Notes

以下已经不是当前主架构：

- `connect-ticket`
- `agent-mesh connect`
- 每个 agent 一个单独后台进程
- MCP 作为平台主入口

如果旧文档还出现这些概念，以当前 daemon-first 架构为准。
