# CyberQuest 2.0

AI-assisted, safety-first CTF learning platform with a Vue 3 client and NestJS/Prisma API. It intentionally limits terminal commands to a small audited allow-list and models labs as private, time-limited instances; it never executes arbitrary host commands.

## Current implementation

The default development path is a self-contained local learning platform. It uses the JSON data store in `apps/server/data/` to provide real authentication, challenge state, scoring, skills, hints, audit activities, guided training sessions, leaderboards, learning paths, the attack-map scenario, and a safe Mock AI tutor. The local session is deliberately not a container shell and does not reach external targets.

The PostgreSQL, Redis and Docker definitions remain in the repository as the next production-architecture phase. They are not required to run the current verified local demonstration loop.

## Quick start

1. Copy `.env.example` to `.env`.
2. Install Node dependencies with `corepack pnpm install`.
3. Build once with `corepack pnpm build`.
4. Run locally with `corepack pnpm dev`, then open `http://localhost:5173`.

The server reads and updates `apps/server/data/cyberquest.local.json`. It is local learning state, not a production database; do not commit personal or shared deployment data from that file. If it is absent, the server creates a clean local copy from `apps/server/data/cyberquest.seed.json`.

Docker Compose is retained as a production-architecture scaffold and will be verified after the JSON-to-Prisma repository migration.

## Prisma preparation (Docker can wait)

The production schema is ready to be checked without starting Docker. Copy `apps/server/.env.example` to `apps/server/.env`, then run `corepack pnpm db:validate` and `corepack pnpm db:generate`. `db:push` and `db:seed` require a reachable PostgreSQL instance and are deliberately deferred to the Docker/production stage.

The Prisma seed contains only Argon2id flag-verification hashes. It is not an authoring source for plaintext flags, and no challenge endpoint exposes either plaintext flags or their hashes.

When PostgreSQL is available, set `DATA_BACKEND=prisma` in the server environment. The server loads `apps/server/.env` before choosing its repository, defaults to `local`, and rejects any other value. In production Prisma mode it also requires distinct `JWT_ACCESS_SECRET` and `ATTEMPT_HASH_SECRET` values. `corepack pnpm db:check` type-checks the TypeScript Prisma seed without connecting to a database.

`DATA_BACKEND=prisma` selects the transactional `PrismaLearningRepository`; `DATA_BACKEND=local` selects the JSON demonstration store. The PostgreSQL connection, migration execution, and integration tests still require a database and remain deferred with Docker.

## Demo identities

| User | Email | Password | Role |
| --- | --- | --- | --- |
| demo | `demo@cyberquest.local` | `CyberQuest123!` | USER |
| admin | `admin@cyberquest.local` | `CyberQuest123!` | ADMIN |

## Verification

Run `corepack pnpm build`. With the API running, `corepack pnpm verify:demo` checks demo login plus seeded challenges and skills. The local API also supports challenge workspaces, hint unlocks, server-side hash validation, score/skill updates, audit activities, time-limited guided sessions, and authenticated realtime notifications.

## API and realtime

REST endpoints are prefixed with `/api`: auth, challenges, dashboard, skills, labs, AI, courses and leaderboard. The authenticated Socket.IO namespace is `/events`; it emits `session.ready`, `challenge.solved`, `leaderboard.updated`, and private `lab.status` events. Socket.IO never accepts learning mutations, and event payloads exclude flags, hashes, access tokens, and cross-user lab details. Redis-backed fan-out and Docker-backed labs remain deferred.

Flags are stored only as server-side hashes in the local data store and are never returned by challenge endpoints. The production database migration will replace the local SHA-256 compatibility format with Argon2 or a peppered server-side hash. The `Mock` AI provider remains available without an external key. `OPENAI_API_KEY` and `AI_PROVIDER` are reserved for a production provider implementation.

## 无 Docker 本地运行模式

当前开发版本默认提供单机持久化后端，不需要安装 Docker、PostgreSQL 或 Redis：

```powershell
corepack pnpm --filter @cyberquest/server build
node apps/server/dist/main.js
corepack pnpm --filter @cyberquest/web dev
```

打开 `http://127.0.0.1:5173` 后可注册账户或使用 `demo@cyberquest.local` 登录。用户、题目提交、积分、排行榜、技能与本地学习会话会真实保存到 `apps/server/data/cyberquest.local.json`。该文件只保存 Flag 哈希和提交哈希，不保存明文答案或明文密码。
