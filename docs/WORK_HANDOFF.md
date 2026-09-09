# CyberQuest 2.0 交接文档

最后更新：2026-09-09（第六阶段：安全 Socket.IO 实时事件）

## 当前目标

按《CyberQuest 2.0》规格完成可演示、可迁移、默认安全的 CTF 学习平台。当前优先保证本地教学闭环稳定；Docker 与真实基础设施按用户授权延后。

## 已完成

### 第一阶段：本地可运行教学闭环（已推送）

- Vue 3 前端已接通 NestJS 本地 API：认证、题库、工作台、提示、Flag 提交、积分、技能、受控训练会话、排行榜、学习路径、攻击推演与 Mock AI。
- `LocalStoreService` 提供本地 JSON 持久化；`LearningRepository` 是替换持久化实现的应用边界。
- 运行态文件 `apps/server/data/cyberquest.local.json` 已被 Git 忽略；不存在时由受版本控制的 `cyberquest.seed.json` 重建。
- 完成登录、题目、提示、训练会话、技能、AI 与未授权响应的 API 实测；全项目生产构建通过。

### 第二阶段：生产数据模型与安全种子（本次完成）

- `apps/server/prisma/seed.ts` 不再保存任何明文 Flag；20 道题目均使用 Argon2id 校验哈希。
- Prisma 模型补齐并建立关系：刷新会话 `Session`、课程进度 `CourseProgress`、成就 `Achievement` / `UserAchievement`、用户活跃时间，以及题目的动态实例标志。
- `UserHint` 补齐用户外键关系，移除重复的联合唯一约束；`Course` 增加创建/更新时间和进度关联。
- 新增 `apps/server/.env.example`，解决 monorepo 中 Prisma 从服务端目录读取环境变量的约定；根脚本增加 `db:validate`。
- README 明确区分“无需 Docker 的 Prisma 验证”与“需要 PostgreSQL 的推送/种子导入”。
- 本地 JSON 数据与 PostgreSQL 种子的数据安全边界已写入 `apps/server/data/README.md`。

### 第三阶段：可切换 Prisma 持久化层（已完成，待网络推送）

- 新增 `PrismaService` 与 `PrismaLearningRepository`；`DATA_BACKEND=local|prisma` 显式决定注入的 `LearningRepository`，默认值为 `local`。
- Prisma 实现覆盖现有 API 契约：认证、用户/技能、题库/提示、Flag 提交、积分/技能、受控训练会话、仪表盘、排行榜、课程、攻击推演与安全 Mock AI。
- Prisma Flag 校验使用 Argon2id；候选 Flag 仅以带密钥的 HMAC-SHA-256 审计哈希保存。解题、积分、技能、提示扣分和活动记录使用数据库事务。
- 服务启动前读取服务端 `.env`；非法 `DATA_BACKEND` 立即失败。生产 Prisma 模式强制要求独立的 `JWT_ACCESS_SECRET` 与 `ATTEMPT_HASH_SECRET`。
- Prisma 种子新增每道题的通用教学提示，仍不含明文 Flag；`db:check` 对种子脚本单独做 TypeScript 检查。

### 第四阶段：API 输入验证（本次完成，待推送）

- 新增 class-validator DTO：登录、注册、Flag 提交、训练会话启动和 AI 对话都带有明确的类型、长度、格式与数值范围限制。
- 全局 `ValidationPipe` 开启 `forbidNonWhitelisted`，多余字段会返回 400，降低批量赋值和未预期输入风险。
- 控制器移除请求体与客户端 IP 的宽泛 `any`，将受控输入直接传给仓储接口。

### 第五阶段：共享响应契约与课程对齐（本次完成，待推送）

- `packages/shared` 新增认证、题目详情、提示、训练会话、提交结果、仪表盘、排行榜、能力、课程与攻击推演响应模型。
- `LearningRepository` 改为以共享类型表达返回值；本地 JSON 与 Prisma 两个实现均经 TypeScript 约束。
- 服务器和前端均声明对 `@cyberquest/shared` 的 workspace 依赖，锁文件已同步。
- Prisma `Course` 模型新增 `challengeSlug` 与 `chapters`，种子为 3 条课程补齐章节和对应挑战；Prisma 返回同时映射 `difficulty` 到前端兼容的 `level`。
- 本地学习概览补齐 `progress` 字段，保持 local 与 prisma 响应契约一致。

### 第六阶段：安全 Socket.IO 实时事件（本次完成，待推送）

- 新增认证型 `/events` Socket.IO gateway；握手必须携带有效 JWT，伪造、过长或缺失 Token 会被立即断开。
- 网关不接受任何业务 mutation；题目提交、提示和训练状态修改仍只走 DTO 校验后的 REST API。
- 服务端只推送最小脱敏事件：`session.ready`、`challenge.solved`、`leaderboard.updated`，以及仅发送至当前用户房间的 `lab.status`。
- 共享包提供实时事件类型；前端登录后可选连接、退出时断开，连接失败平稳维持 REST 功能并显示连接状态。
- README 已记录事件命名空间、安全边界与 Redis/Docker 尚未接入的事实。

## 本次验证

- `corepack pnpm --filter @cyberquest/server exec prisma validate`：通过（临时 PostgreSQL 连接串，仅校验模型，不连接数据库）。
- `corepack pnpm --filter @cyberquest/server prisma:generate`：通过。
- `corepack pnpm --filter @cyberquest/server exec tsc --noEmit`：通过。
- `corepack pnpm build`：通过（shared、NestJS、Vue/Vite）。
- `rg 'flag\\{' apps/server/prisma apps/server/data`：无匹配，确认种子目录不存在明文 Flag。
- `git diff --check`：通过。
- 本地模式回归：健康检查、demo 登录、题目详情、技能读取均通过；题目响应确认不含 `flagHash`。
- DTO 回归：有效登录与题目读取通过；登录请求混入 `role` 字段被正确拒绝为 HTTP 400。
- 学习中心回归：demo 登录后返回 3 条课程；首条课程具有配套挑战、3 个章节与数值进度。
- `corepack pnpm build`、`db:check`、`db:validate`、明文 Flag 扫描和 `git diff --check` 均通过。
- 实时回归：有效 JWT 收到私有 `lab.status`（`RUNNING`）事件；伪造 JWT 被 Socket.IO 服务器断开；事件字段扫描确认没有 Flag、哈希或 Token。
- 还没有可用 PostgreSQL，因此 Prisma 分支只完成编译/Schema/种子检查，尚未做真实数据库集成验证。

## GitHub 状态

- 远程仓库：`https://github.com/ll0210/L2.git`
- 分支：`main`
- 已推送的第一阶段基线：`a3cdd2d`、`087dc50`、`c3ca968`。
- 第二阶段提交 `9c52a5b`（`feat: harden prisma seed and data model`）已推送到同一分支；运行态 JSON 与任何 `.env` 文件不得提交。
- 第三阶段提交 `ab1cac6` 与第四阶段提交 `0d9ef3d` 已成功推送到 `origin/main`；此前 HTTPS 连接重置的问题已在重试后恢复。
- 第五阶段提交 `eb528c6` 已成功推送到 `origin/main`。
- 第六阶段会作为独立提交推送到同一分支。
- 工作区发现 `workspace-preview.png` 的既有删除状态，本阶段不会恢复、删除或提交它。
- 当前仓库专用提交身份：`Codex <codex@local>`，没有修改全局 Git 设置。

## 重要实现约束

- Flag 只能在服务端校验；接口和前端不得输出明文 Flag、校验哈希或真实用户凭据。
- 当前本地 JSON 兼容层仍为 SHA-256 哈希；新建的 Prisma 生产种子采用 Argon2id。切到 Prisma 后，提交校验必须走 Argon2id 路径。
- 本地训练会话是固定教学引导，不执行任意宿主机命令、不扫描外部目标。
- Docker、PostgreSQL、Redis、Socket.IO 的真实部署还未启用，不能将它们描述为已交付能力。

## 下一位执行者从这里开始

1. 补充 OpenAPI/错误码/环境变量文档，并将验证过程自动化为可重复脚本。
2. 获得 PostgreSQL 环境后，执行 `db:push` / `db:seed`，并对 Prisma 分支做认证、解题并发、提示、会话与排行榜集成测试；再生成正式 migration。
3. 继续把仓储内部的 `Record<string, any>` 限缩到领域 DTO，优先处理本地 JSON 实现。
4. 用户确认 Docker 条件后，再运行 PostgreSQL/Redis、生成迁移并验证 compose；不要提前宣称容器化可用。
