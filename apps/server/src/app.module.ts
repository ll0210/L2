import { Module } from '@nestjs/common';
import { HealthController } from './modules/health';
import { LocalController } from './modules/local.controller';
import { LocalStoreService } from './modules/local.store';
import { LEARNING_REPOSITORY } from './modules/learning.repository';

/** 单机开发模式：无需 Docker、PostgreSQL 或 Redis 即可体验完整学习闭环。 */
@Module({
  controllers: [HealthController, LocalController],
  providers: [LocalStoreService, { provide: LEARNING_REPOSITORY, useExisting: LocalStoreService }],
})
export class AppModule {}
