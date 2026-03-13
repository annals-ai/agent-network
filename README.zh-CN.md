# ah-cli

[![npm version](https://img.shields.io/npm/v/%40annals%2Fah-cli.svg)](https://www.npmjs.com/package/@annals/ah-cli)
[![npm downloads](https://img.shields.io/npm/dm/%40annals%2Fah-cli.svg)](https://www.npmjs.com/package/@annals/ah-cli)
[![license](https://img.shields.io/github/license/annals-ai/ah-cli.svg)](./LICENSE)

[English](./README.md) | [中文](./README.zh-CN.md)

ah-cli 现在是一个 daemon-first 的本地运行时：一台机器上跑一个 daemon，统一管理多个 Agent、多个 Session，以及按需暴露到 Agents Hot 之类的 provider。它还自带一个由 daemon 启动的本地 Web UI，方便所有者查看 transcript、task、provider 暴露状态和日志，而不需要把完整历史上传到平台。

## 安装

```bash
pnpm add -g @annals/ah-cli
```

## 快速开始

```bash
ah login
ah daemon start
ah ui open
ah agent add --name "Code Reviewer" --project /path/to/project --runtime-type claude
ah chat "Code Reviewer" "Review this repo"
ah agent expose "Code Reviewer" --provider agents-hot
ah agent expose "Code Reviewer" --provider generic-a2a --config-json '{"port":4123,"bearerToken":"replace-me"}'
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

- `ah daemon start` 会同时启动 daemon 和本地 Web UI backend
- `ah ui open` 会在浏览器中打开当前本地 Web UI
- `ah ui serve` 会确保 daemon 支撑的 Web UI 正在运行，并打印 URL
- 第一次成功的交互式 daemon 启动会自动打开浏览器
- Electron 或 Tauri 只是后续包装方向，不在 v1 范围内

## 主要命令

```bash
ah login
ah status

ah daemon start|stop|status|logs
ah ui serve|open

ah agent add --name --project [--sandbox]
ah agent list
ah agent show <ref>
ah agent update <ref>
ah agent remove <ref>
ah agent expose <ref> --provider agents-hot|generic-a2a [--config-json '{}']
ah agent unexpose <ref> --provider agents-hot|generic-a2a

ah task create --title "..."
ah task list
ah task show <id>
ah task archive <id>

ah session list
ah session show <id>
ah session attach <id> [message]
ah session fork <id>
ah session stop <id>
ah session archive <id>

ah chat <agent> [message]
ah call <agent> --task "..."
ah discover --capability <keyword>
ah skills ...
ah subscribe ...
ah profile ...
```

## 沙箱

沙箱现在是显式可选能力。

- 不开沙箱：直接在 `--project` 目录工作
- 开沙箱：创建隔离 workspace，并启用文件相关流程

是否开启沙箱不会改变 session 的归属关系。

## Provider 示例

```bash
# 暴露到 Agents Hot
ah agent expose "Code Reviewer" --provider agents-hot

# 在本机 HTTP 端口上暴露标准 Generic A2A 入口
ah agent expose "Code Reviewer" \
  --provider generic-a2a \
  --config-json '{"port":4123,"bearerToken":"replace-me"}'

# 查看生成出来的 card / jsonrpc / health URL
ah agent show "Code Reviewer" --json
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
ah-cli/
├── packages/
│   ├── cli/       # daemon-first CLI
│   ├── ui/        # 本地 Web UI workspace
│   ├── protocol/  # bridge 协议类型
│   └── worker/    # bridge worker / durable objects
├── tests/
└── CLAUDE.md
```
