# CyberQuest 2.0 交接文档

最后更新：2026-09-09（第二阶段：Prisma 数据模型与安全种子）

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

## 本次验证

- `corepack pnpm --filter @cyberquest/server exec prisma validate`：通过（临时 PostgreSQL 连接串，仅校验模型，不连接数据库）。
- `corepack pnpm --filter @cyberquest/server prisma:generate`：通过。
- `corepack pnpm --filter @cyberquest/server exec tsc --noEmit`：通过。
- `corepack pnpm build`：通过（shared、NestJS、Vue/Vite）。
- `rg 'flag\\{' apps/server/prisma apps/server/data`：无匹配，确认种子目录不存在明文 Flag。
- `git diff --check`：通过。

## GitHub 状态

- 远程仓库：`https://github.com/ll0210/L2.git`
- 分支：`main`
- 已推送的第一阶段基线：`a3cdd2d`、`087dc50`、`c3ca968`。
- 本文档所在的第二阶段提交会在验证后推送到同一分支；运行态 JSON 与任何 `.env` 文件不得提交。
- 当前仓库专用提交身份：`Codex <codex@local>`，没有修改全局 Git 设置。

## 重要实现约束

- Flag 只能在服务端校验；接口和前端不得输出明文 Flag、校验哈希或真实用户凭据。
- 当前本地 JSON 兼容层仍为 SHA-256 哈希；新建的 Prisma 生产种子采用 Argon2id。切到 Prisma 后，提交校验必须走 Argon2id 路径。
- 本地训练会话是固定教学引导，不执行任意宿主机命令、不扫描外部目标。
- Docker、PostgreSQL、Redis、Socket.IO 的真实部署还未启用，不能将它们描述为已交付能力。

## 下一位执行者从这里开始

1. 基于 `LearningRepository` 实现 `PrismaLearningRepository` 与 `PrismaService`，通过显式环境配置切换 `local` / `prisma` 后端；保留现有 HTTP 契约。
2. 为挑战提交、提示解锁、积分/技能更新与排行榜建立事务和幂等性测试；将接口返回的宽泛 `any` 收紧为共享 DTO。
3. 再实施 Socket.IO/Redis 的实时事件层。
4. 用户确认 Docker 条件后，再运行 PostgreSQL/Redis、生成迁移并验证 compose；不要提前宣称容器化可用。
