import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const message = typeof detail.message === 'string'
      ? detail.message
      : Array.isArray(detail.message)
        ? detail.message.join('；')
        : exception instanceof Error
          ? exception.message
          : '服务暂时不可用';
    response.status(status).json({ statusCode: status, code: typeof detail.code === 'string' ? detail.code : `HTTP_${status}`, message, timestamp: new Date().toISOString(), path: request.url });
  }
}

