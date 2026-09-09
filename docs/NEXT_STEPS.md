# CyberQuest 2.0 后续执行清单

最后更新：2026-09-09

## 当前完成点

- 本地 JSON 教学闭环可运行并已完成 GitHub 初始交付。
- Prisma Schema 已可校验和生成客户端；生产种子不含明文 Flag。
- 第二阶段安全数据模型提交 `9c52a5b` 已推送至 `origin/main`。
- `DATA_BACKEND=local|prisma` 已可切换仓储实现；Prisma 分支尚待真实 PostgreSQL 集成验证。
- 输入 DTO、白名单与未知字段拒绝已覆盖认证、Flag、训练会话和 AI 请求。
- 第三、四阶段提交 `ab1cac6`、`0d9ef3d` 已同步至 `origin/main`。
- Docker 暂缓，不是当前阶段的前置条件。

## 下一大阶段：API 响应 DTO 与仓储类型收紧

1. 在 `packages/shared` 定义认证、题目、错误、训练会话、排行榜和 AI 响应 DTO。
2. 为 `LearningRepository` 标注 Promise/返回类型，让 Local 与 Prisma 实现受编译器约束。
3. 复跑本地 API 契约回归，确认前端依旧可消费响应。
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
