FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile && pnpm --filter @cyberquest/server prisma:generate && pnpm --filter @cyberquest/server build
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @cyberquest/server prisma:push && pnpm --filter @cyberquest/server prisma:seed && pnpm --filter @cyberquest/server start"]
