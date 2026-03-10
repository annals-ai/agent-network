---
name: agent-network-creator
description: |
  Interactive workflow for creating, configuring, exposing, and managing
  AI agents on Agents.Hot using the daemon-first ah CLI.
  Also covers CLI command reference, flags, skill publishing, and troubleshooting.
  Trigger words: create agent, manage agent, publish agent,
  agent description, agent setup, list agents, delete agent, expose agent,
  agent-network command, CLI help, agent-network flags, daemon, session,
  agent-network troubleshooting, publish skill, skill init,
  skill pack, skill version, skills list, unpublish skill,
  install skill, update skill, remove skill, installed skills.
version: 0.0.6
---

# Agent Network — Create, Manage & Expose Agents

## How Agent Network Works

Agent Network 现在是 **daemon-first 本地运行时**：

1. 一台机器只跑一个 daemon。
2. daemon 统一管理多个本地 agent、多个 session、多个 task group。
3. 本地 `chat` / `call` 先命中 daemon。
4. 需要上线时，再通过 provider 暴露：
   - `agents-hot`
   - `generic-a2a`

正确心智不是“先 create 再 connect”，而是：

`daemon start -> agent add -> 本地 chat/call -> agent expose`

## Behavior

这是一个交互式工作流，不是纯参考文档。

当此 skill 触发时：

1. 先判断用户是要“新建 agent / 管理本地 agent / 对外暴露 / 删除 / 调试”中的哪一种。
2. 一次只推进一个步骤。
3. 优先直接执行命令并核对输出，不要只讲理论。
4. 如果命令失败，先诊断失败原因，再给重试路径。
5. 不再把 `connect-ticket`、`connect --setup`、`agents publish` 当主流程。

## Prerequisites

在开始任何工作流前，先验证环境：

```bash
ah --version
ah status
```

如果 CLI 缺失：

```bash
pnpm add -g @annals/agent-network
ah --version
```

如果未登录：

```bash
ah login
```

## Workflow Routing

| Intent | Workflow |
|--------|----------|
| New agent from scratch | Create -> Set up Folder -> Local Test -> Expose |
| Add skills to existing agent | Set up Folder |
| Manage local agents | List / Show / Update / Remove |
| Resume or fork work | Session / Task |
| Make an agent available online | Expose |
| Test end-to-end | Local Test -> Remote Test |
| Remove agent | Delete |
| Publish a skill to the platform | See `references/skill-publishing.md` |

## Supported Runtime

| Type | Runtime | Status |
|------|---------|--------|
| `claude` | Claude Code CLI | Available |

只有 `claude` 仍然是当前支持的 agent runtime。

## Create

按顺序收集三个输入：

1. Agent name
2. Project path
3. Description / capabilities / visibility

### Execute

```bash
ah daemon start
ah agent add \
  --name "<name>" \
  --slug "<slug>" \
  --project "<project-path>" \
  --runtime-type claude \
  --description "<description>" \
  --visibility private \
  --capabilities capability-a,capability-b
```

创建完成后，立即进入 Set up Folder。

## Set up Folder

当前 agent 的工作目录就是 `--project`。

如果 agent 使用 Claude 运行时，目录内至少要有：

```text
<project>/
├── CLAUDE.md
└── .claude/
    └── skills/
        └── <skill-name>/SKILL.md
```

规则：

1. `CLAUDE.md` 必须存在。
2. 描述里提到的 slash skill，必须有对应 `SKILL.md`。
3. agent 自己用的 skill 放在 agent 项目目录里，不放在开发者全局目录。

## Local Test

先验证 agent 在本地 daemon 内能工作：

```bash
ah chat "<agent-ref>" "Hello, what can you do?"
ah call "<agent-ref>" --task "Describe your core capability."
```

如果要继续同一个上下文：

```bash
ah session list
ah session show <session-id>
ah session attach <session-id> "Continue"
ah session fork <session-id>
```

## Expose

### Expose 到 Agents Hot

```bash
ah agent expose "<agent-ref>" --provider agents-hot
ah agent show "<agent-ref>" --json
```

检查点：

1. binding status = `online`
2. 存在 `remoteAgentId`
3. 平台侧 agent `is_published=true`
4. 平台侧 agent `is_online=true`

### Expose 到 Generic A2A

```bash
ah agent expose "<agent-ref>" \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

ah agent show "<agent-ref>" --json
```

检查点：

1. binding status = `online`
2. config 里出现：
   - `cardUrl`
   - `jsonrpcUrl`
   - `healthUrl`

## Manage Existing Local Agents

```bash
ah agent list
ah agent show <ref> --json
ah agent update <ref> --description "..."
ah agent update <ref> --visibility public
ah agent remove <ref>
```

## Delete

删除前先确认是否还需要保留 provider exposure 和本地 session。

```bash
ah agent unexpose <ref> --provider agents-hot
ah agent remove <ref>
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Local agent not found` | 先 `ah agent list`，确认 daemon registry 里是否存在 |
| `Timed out waiting for ah daemon to start` | 检查 Node 版本、旧 pid/socket、日志 |
| `Not authenticated` | 先 `ah login` |
| `Agent is not available` | 检查 provider binding 和平台侧 `is_online` / `is_published` |
| `generic-a2a private exposures require bearerToken` | 给 `--config-json` 传 `bearerToken` |
| 本地可聊，线上不可用 | 先看 `agent show --json` 的 binding，再看平台记录 |

## Full CLI Reference

完整命令参考见：

- `references/cli-reference.md`
- `references/skill-publishing.md`
