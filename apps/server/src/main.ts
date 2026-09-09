import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ApiExceptionFilter } from './common/security';
async function bootstrap(){ const app=await NestFactory.create(AppModule); app.setGlobalPrefix('api'); app.use(helmet({contentSecurityPolicy:false})); app.use(cookieParser()); app.enableCors({origin:process.env.NODE_ENV==='production'?(process.env.CORS_ORIGIN?.split(',') ?? false):true,credentials:true}); app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true})); app.useGlobalFilters(new ApiExceptionFilter()); await app.listen(Number(process.env.SERVER_PORT ?? 3000),'0.0.0.0'); }
bootstrap();
