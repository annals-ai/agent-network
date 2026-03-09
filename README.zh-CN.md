# Agent Network

[![npm version](https://img.shields.io/npm/v/@annals/agent-network.svg)](https://www.npmjs.com/package/@annals/agent-network)
[![npm downloads](https://img.shields.io/npm/dm/@annals/agent-network.svg)](https://www.npmjs.com/package/@annals/agent-network)
[![license](https://img.shields.io/github/license/annals-ai/agent-network.svg)](./LICENSE)

[English](./README.md) | [中文](./README.zh-CN.md)

Agent Network 现在是一个 daemon-first 的本地运行时：一台机器上跑一个 daemon，统一管理多个 Agent、多个 Session，以及按需暴露到 Agents Hot 之类的 provider。它还自带一个由 daemon 启动的本地 Web UI，方便所有者查看 transcript、task、provider 暴露状态和日志，而不需要把完整历史上传到平台。

## 安装

```bash
pnpm add -g @annals/agent-network
```

## 快速开始

```bash
agent-network login
agent-network daemon start
agent-network ui open
agent-network agent add --name "Code Reviewer" --project /path/to/project --runtime-type claude
agent-network chat "Code Reviewer" "Review this repo"
agent-network agent expose "Code Reviewer" --provider agents-hot
agent-network agent expose "Code Reviewer" --provider generic-a2a --config-json '{"port":4123,"bearerToken":"replace-me"}'
```

## 核心模型

- 一台机器一个本地 daemon
- 一个 daemon 管多个本地 Agent
- 每个 Agent 可以有多条 Session
- 用 Task Group 组织相关工作
- 是否上线由 provider binding 决定
- 用本地 Web UI 查看 transcript、task、provider 和日志

本地 SQLite 是 daemon 的唯一真源。完整 transcript 历史保留在本地 daemon，并通过本地 Web UI 查看。`chat` 和 `call` 默认先命中本地 daemon；线上入口只是把请求转回同一个 session core。Agents Hot 是网关、发现和鉴权层，不是长期 transcript surface。

## 本地历史界面

- `agent-network daemon start` 会同时启动 daemon 和本地 Web UI backend
- `agent-network ui open` 会在浏览器中打开当前本地 Web UI
- `agent-network ui serve` 会确保 daemon 支撑的 Web UI 正在运行，并打印 URL
- 第一次成功的交互式 daemon 启动会自动打开浏览器
- Electron 或 Tauri 只是后续包装方向，不在 v1 范围内

## 主要命令

```bash
agent-network login
agent-network status

agent-network daemon start|stop|status|logs
agent-network ui serve|open

agent-network agent add --name --project [--sandbox]
agent-network agent list
agent-network agent show <ref>
agent-network agent update <ref>
agent-network agent remove <ref>
agent-network agent expose <ref> --provider agents-hot|generic-a2a [--config-json '{}']
agent-network agent unexpose <ref> --provider agents-hot|generic-a2a

agent-network task create --title "..."
agent-network task list
agent-network task show <id>
agent-network task archive <id>

agent-network session list
agent-network session show <id>
agent-network session attach <id> [message]
agent-network session fork <id>
agent-network session stop <id>
agent-network session archive <id>

agent-network chat <agent> [message]
agent-network call <agent> --task "..."
agent-network discover --capability <keyword>
agent-network skills ...
agent-network subscribe ...
agent-network profile ...
```

## 沙箱

沙箱现在是显式可选能力。

- 不开沙箱：直接在 `--project` 目录工作
- 开沙箱：创建隔离 workspace，并启用文件相关流程

是否开启沙箱不会改变 session 的归属关系。

## Provider 示例

```bash
# 暴露到 Agents Hot
agent-network agent expose "Code Reviewer" --provider agents-hot

# 在本机 HTTP 端口上暴露标准 Generic A2A 入口
agent-network agent expose "Code Reviewer" \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

# 查看生成出来的 card / jsonrpc / health URL
agent-network agent show "Code Reviewer" --json
```

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## 仓库结构

```txt
agent-network/
├── packages/
│   ├── cli/       # daemon-first CLI
│   ├── ui/        # 本地 Web UI workspace
│   ├── protocol/  # bridge 协议类型
│   └── worker/    # bridge worker / durable objects
├── tests/
└── CLAUDE.md
```
