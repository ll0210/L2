import { Module } from '@nestjs/common';
import { HealthController } from './modules/health';
import { LocalController } from './modules/local.controller';
import { LocalStoreService } from './modules/local.store';
import { LEARNING_REPOSITORY } from './modules/learning.repository';
import { PrismaLearningRepository } from './modules/prisma-learning.repository';
import { PrismaService } from './modules/prisma.service';
import { loadRuntimeEnvironment } from './common/environment';

loadRuntimeEnvironment();
const dataBackend = process.env.DATA_BACKEND ?? 'local';
if (!['local', 'prisma'].includes(dataBackend)) throw new Error('DATA_BACKEND must be either "local" or "prisma".');
if (dataBackend === 'prisma' && process.env.NODE_ENV === 'production' && (!process.env.JWT_ACCESS_SECRET || !process.env.ATTEMPT_HASH_SECRET)) {
  throw new Error('JWT_ACCESS_SECRET and ATTEMPT_HASH_SECRET are required for a production Prisma backend.');
}

const storageProviders = dataBackend === 'prisma'
  ? [PrismaService, PrismaLearningRepository, { provide: LEARNING_REPOSITORY, useExisting: PrismaLearningRepository }]
  : [LocalStoreService, { provide: LEARNING_REPOSITORY, useExisting: LocalStoreService }];

/** 单机开发模式：无需 Docker、PostgreSQL 或 Redis 即可体验完整学习闭环。 */
@Module({
  controllers: [HealthController, LocalController],
  providers: storageProviders,
})
export class AppModule {}
