# CyberQuest 2.0 后续执行清单

最后更新：2026-09-09

## 当前完成点

- 本地 JSON 教学闭环可运行并已完成 GitHub 初始交付。
- Prisma Schema 已可校验和生成客户端；生产种子不含明文 Flag。
- 第二阶段安全数据模型提交 `9c52a5b` 已推送至 `origin/main`。
- Docker 暂缓，不是当前阶段的前置条件。

## 下一大阶段：可切换的 Prisma 持久化层

1. 新增 `PrismaService` 和 `PrismaLearningRepository`，实现与 `LearningRepository` 对应的读取与写入能力。
2. 以 `DATA_BACKEND=local|prisma` 作为显式选择，默认仍是 `local`，避免没有 PostgreSQL 时破坏现有演示。
3. 按安全边界实现：Argon2id Flag 校验、刷新会话哈希、请求限流、审计活动、挑战解题事务、积分与技能更新。
4. 将控制器和前端 API 返回模型转换为 `packages/shared` 内的 DTO；移除接口层宽泛 `any`。
5. 编写不依赖 Docker 的单元测试与契约测试；有 PostgreSQL 后再补充集成测试、迁移和种子导入。
6. 阶段验收后更新 `WORK_HANDOFF.md` 与本文件，提交并推送 `origin/main`。

## 随后的阶段

1. 实时层：Socket.IO 事件（解题、排行榜、训练状态、通知）与 Redis 缓存/排行榜适配器。
2. AI 层：Provider 接口、Mock/OpenAI 配置、提示等级与敏感答案过滤、限流审计。
3. Docker 阶段（用户确认时执行）：私有网络、非 root 容器、资源限制、只读文件系统、TTL 清理、PostgreSQL/Redis、迁移与端到端验证。
4. 质量与交付：E2E、错误码文档、OpenAPI、可观测性、CI 与部署说明。

## 每次回复的固定收尾

1. 更新 `docs/WORK_HANDOFF.md`，记录已完成内容、验证结果、风险与下一入口。
2. 更新本文件，写明接下来可执行的步骤。
3. 每完成一个可验收大阶段，先验证，再提交并推送到 `https://github.com/ll0210/L2.git` 的 `main` 分支。
