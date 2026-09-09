import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** A deliberately thin client provider; connection lifecycle belongs to the selected repository. */
@Injectable()
export class PrismaService extends PrismaClient {}
