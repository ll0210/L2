# CyberQuest 2.0 交接文档

最后更新：2026-09-09（本地闭环与数据治理阶段已推送）

## 当前目标

按《CyberQuest 2.0 Codex 工程开发规格与施工大纲》完成一个可编译、可部署、可演示的安全优先 CTF 学习平台。

## 起始基线（已解决的阻断项）

- 仓库目前不是 Git 仓库，未配置远程地址。
- 前端已有 Vue 页面与较完整的视觉样式，但多个页面依赖不存在的 `src/stores/auth`。
- 后端的 TypeScript 入口依赖不存在的 `modules/health`、`modules/local.controller`、`modules/local.store` 与 `common/security`。
- Prisma Schema、Docker Compose 与早期 NestJS 编译产物来自另一套未完整保留的架构，不能作为当前运行入口。
- 本地 JSON 数据有效，含 6 道教学挑战、账号、提示、提交记录、受控会话与课程数据。
- `node_modules` 只有不完整的链接/元数据，导致无法运行 TypeScript 检查或构建。

## 实施决策

第一阶段采用现有页面所指向的“本地 JSON 持久化 API”恢复真实学习闭环：认证、题库、工作台、提示解锁、受控会话、提交计分、技能经验、仪表盘、学习路径、攻击推演与排行榜。

Docker、PostgreSQL/Redis/Prisma 迁移及 Socket.IO 实时层放在本地闭环可验证之后。这样可先得到可运行成果，后续再把持久层与实时能力替换为生产架构。

## 本轮完成内容

- 新增可运行的 NestJS 本地 API：`HealthController`、`LocalController`、`LocalStoreService`、统一错误过滤器。
- 覆盖认证、个人资料、题库、题目详情、工作台、提示解锁、Flag 提交、积分/技能、受控会话、仪表盘、排行榜、学习、攻击推演、Mock AI 与题源接口。
- 新增 Pinia `auth` 状态；短期 access token 改用 `sessionStorage`，退出时清理。
- 新增共享 API/领域基础类型，修复 `packages/shared` 无源码而无法构建的问题。
- README 已区分当前可运行的本地 JSON 演示模式与后续生产架构。
- 依赖已按锁文件完整安装；`corepack pnpm build` 成功。
- 新增 `cyberquest.seed.json` 作为可复现种子；运行时 `cyberquest.local.json` 已加入忽略规则，服务端会在其缺失时自动复制种子。
- 新增 `LearningRepository` 端口并改由控制器注入该端口；未来 Prisma 实现可替换 JSON 实现而不改动 HTTP 接口。
- 已移除三个未被实际构建使用、且引用已不存在模块的陈旧 JavaScript 源文件。

## 验收结果

- 服务端 TypeScript 检查通过：`corepack pnpm --filter @cyberquest/server exec tsc --noEmit`。
- 全工作区生产构建通过：`corepack pnpm build`。
- 本地 API 已实际验证：demo 登录、6 道题目读取、工作台读取、会话启动/停止、技能记录、Mock AI、安全 401 响应。
- 验收期间写入了 demo 的登录、AI 与会话审计记录，属于本地持久化演示数据的正常行为。
- 验收启动的 3000 与 5173 端口服务已停止。
- 种子 JSON 已单独解析验证：2 个演示账号、6 道题目、3 条课程、无明文 Flag；运行时数据忽略规则生效。

## 尚未完成

1. 补充 API、架构、安全与验收文档。
2. 将运行时 JSON 数据与可提交的种子数据分离。
3. 完成 Docker 化与 PostgreSQL/Redis/Prisma/Socket.IO 阶段。
4. 配置 GitHub 远程仓库并按阶段提交推送。

## GitHub 首次推送所需信息

请在第一次需要推送前提供目标仓库的 HTTPS 或 SSH 地址、目标分支（默认 `main`），并确保当前环境已拥有该仓库的写入权限（SSH Key 或 GitHub 登录令牌）。如需新建仓库，还需说明仓库名称及公开/私有属性。

已初始化本地 Git 仓库并配置远程 `https://github.com/ll0210/L2.git`。首个提交 `a3cdd2d`（`feat: establish runnable CyberQuest local platform`）和首个交接同步提交 `087dc50`（`docs: record initial GitHub delivery`）均已成功推送至 `origin/main`，本地 `main` 正跟踪远程分支。

## 版本控制约定

- 当前 Git 提交身份仅为本地仓库级别的 `Codex <codex@local>`，未修改全局 Git 身份。
- 每个后续可验收大阶段都应先运行相应验证，再提交并推送到 `origin/main`。
- 运行时文件 `apps/server/data/cyberquest.local.json` 已忽略，不能被加入提交。
