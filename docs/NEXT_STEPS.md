# CyberQuest 2.0 后续执行清单

最后更新：2026-09-09

## 当前完成点

- 本地 JSON 教学闭环可运行并已完成 GitHub 初始交付。
- Prisma Schema 已可校验和生成客户端；生产种子不含明文 Flag。
- 第二阶段安全数据模型提交 `9c52a5b` 已推送至 `origin/main`。
- `DATA_BACKEND=local|prisma` 已可切换仓储实现；Prisma 分支尚待真实 PostgreSQL 集成验证。
- 输入 DTO、白名单与未知字段拒绝已覆盖认证、Flag、训练会话和 AI 请求。
- 第三、四阶段提交 `ab1cac6`、`0d9ef3d` 已同步至 `origin/main`。
- 共享响应 DTO、课程章节和课程进度已在 local / prisma 两个仓储之间对齐。
- 第五阶段提交 `eb528c6` 已同步至 `origin/main`。
- `/events` Socket.IO 网关已完成 JWT 握手校验、私有训练状态房间和脱敏公开事件；Redis fan-out 尚未接入。
- OpenAPI 3.1、错误码契约和 `verify:local` 自动验收已完成；验收不依赖 Docker。
- Docker 暂缓，不是当前阶段的前置条件。

## 下一大阶段：安全管理端能力

1. 新增管理员题目、课程、用户和运行态审计的受限 API；所有写操作必须要求 `ADMIN` 角色并记录活动。
2. 复用 class-validator DTO，限制输入、避免明文 Flag 与哈希从管理读取接口泄漏。
3. 前端新增独立管理视图，未授权用户不得加载管理数据或路由。
4. 之后配置 PostgreSQL，以 `DATA_BACKEND=prisma` 执行 `db:push`、`db:seed` 和端到端 API 测试；再建立正式 migration。
5. 阶段验收后更新 `WORK_HANDOFF.md` 与本文件，提交并推送 `origin/main`。

## 随后的阶段

1. 实时层：Socket.IO 事件（解题、排行榜、训练状态、通知）与 Redis 缓存/排行榜适配器。
2. AI 层：Provider 接口、Mock/OpenAI 配置、提示等级与敏感答案过滤、限流审计。
3. Docker 阶段（用户确认时执行）：私有网络、非 root 容器、资源限制、只读文件系统、TTL 清理、PostgreSQL/Redis、迁移与端到端验证。
4. 质量与交付：E2E、错误码文档、OpenAPI、可观测性、CI 与部署说明。

## 每次回复的固定收尾

1. 更新 `docs/WORK_HANDOFF.md`，记录已完成内容、验证结果、风险与下一入口。
2. 更新本文件，写明接下来可执行的步骤。
3. 每完成一个可验收大阶段，先验证，再提交并推送到 `https://github.com/ll0210/L2.git` 的 `main` 分支。
