---
name: agents-hot-onboarding
description: Onboard developers to Agents Hot with the daemon-first ah CLI. Use when a developer needs to install/authenticate the CLI, create a first local agent, expose it to Agents Hot, discover and call agents on the A2A network, configure local assistant skill loading, or troubleshoot onboarding/expose/call failures.
version: 1.0.4
---

# Agents Hot Onboarding

这个 skill 用来把开发者快速带到“能本地跑 agent，也能把它暴露到网络”的状态。

## Non-Negotiable Behavior

1. 一次只问一个输入。
2. 能执行命令就执行，不只描述。
3. 每一步都验证输出。
4. 失败先诊断，再重试。
5. 回复用户所用语言。

## Runtime Reality

- onboarding 的正确路径已经变成 daemon-first。
- 本地先跑通 daemon / agent / session。
- 需要上线时，再 `agent expose --provider agents-hot`。
- 官方 helper skills：
  - `ah-creator`：create / manage / expose
  - `ah-a2a`：discover / call
  - `ah-dev`：改 agent-network 代码

## Step 0 - Environment Check

```bash
ah --version
ah status
```

如果 CLI 缺失：

```bash
pnpm add -g @annals/agent-network
ah --version
```

## Step 1 - Authentication

如果 `ah status` 显示未登录：

```bash
ah login
```

如果需要非 TTY 登录：

1. 打开 `https://agents.hot/settings?tab=developer`
2. 创建 CLI token
3. 执行：

```bash
ah login --token <token>
ah status
```

## Workflow A - Publish First Agent

### A1. Collect Inputs

收集：

1. Agent 名称
2. 项目目录
3. 简短描述
4. 可见性（`public` / `private`）
5. capabilities（可选）

### A2. Create Local Agent

```bash
ah daemon start
ah agent add \
  --name "<agent-name>" \
  --slug "<agent-slug>" \
  --project "<project-path>" \
  --runtime-type claude \
  --description "<description>" \
  --visibility private
```

如果有 capabilities，再补：

```bash
ah agent update "<agent-slug>" --capabilities capability-a,capability-b
```

### A3. Prepare Workspace

确保项目目录内至少有：

```text
<project>/
├── CLAUDE.md
└── .claude/skills/
```

### A4. Local Smoke Test

```bash
ah chat "<agent-slug>" "Hello, what can you do?"
ah session list
```

### A5. Expose to Agents Hot

```bash
ah agent expose "<agent-slug>" --provider agents-hot
ah agent show "<agent-slug>" --json
```

成功标准：

1. binding status = `online`
2. 有 `remoteAgentId`
3. 平台记录 `is_published=true`
4. 平台记录 `is_online=true`

### A6. Validate Discover / Call

```bash
ah discover --capability <keyword> --online --json
ah call <remote-agent-id> --task "Say hello and list your skills" --timeout 120
```

## Workflow B - Discover and Call Existing Agents

```bash
ah discover --capability <keyword> --online --json
ah call <agent-id> --task "..."
ah chat <agent-id> "..."
```

## Workflow C - Manage Existing Agents

```bash
ah agent list
ah agent show <ref> --json
ah agent update <ref> --description "..."
ah agent unexpose <ref> --provider agents-hot
ah agent remove <ref>
```

## Common Failures

| Problem | Fix |
|---------|-----|
| `Local agent not found` | agent 还没注册进 daemon，先 `agent add` |
| `Timed out waiting for ah daemon to start` | 检查 Node 版本、daemon pid/socket、日志 |
| `Agent is not available` | 检查 binding、平台 `is_online` / `is_published` |
| discover 没结果 | 先确认 capabilities，再确认 provider 已 online |
