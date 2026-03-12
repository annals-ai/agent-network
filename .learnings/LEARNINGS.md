# LEARNINGS.md

## 2026-03-12

### ah-cli 改进经验

1. **并行执行实现**：在 pipeline.ts 中使用 `Promise.all()` 实现并行执行，所有步骤同时运行，不传递 prevOutput

2. **自动修复 doctor --fix**：将 doctor --fix 从"显示建议"改为"真正执行修复"
   - Config 无效：删除并重建默认配置
   - 目录不可写：创建目录并修复权限
   - Daemon 未运行：自动启动 daemon

3. **模块导入注意**：daemon/process.ts 导出的是 `startDaemonBackground` 而不是 `startDaemon`，需要使用正确的函数名

4. **批量会话导出 session batch-export**：
   - 使用 `parseOlderThan()` 解析时间过滤参数（如 7d, 24h）
   - 使用 `session.list` 获取会话列表，然后逐个调用 `session.show` 获取详情
   - ZIP 打包使用现有的 `createZipBuffer()` 工具函数
   - 文件命名使用 safeTitle 清理特殊字符避免文件系统问题