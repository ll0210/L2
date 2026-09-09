import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() { return { status: 'ok', service: 'cyberquest-local-api', time: new Date().toISOString() }; }
}

