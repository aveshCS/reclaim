import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

const CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  429: 'too_many_requests',
  503: 'unavailable',
};

/**
 * One error shape everywhere:
 *   { "error": { "status": 400, "code": "bad_request", "message": "...", "requestId": "..." } }
 * Unexpected errors are logged with the request id and never leak details to the client.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const requestId = req.id;

    let status = 500;
    let message = 'Something went wrong.';
    let details: unknown;

    if (err instanceof HttpException) {
      status = err.getStatus();
      const body = err.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: unknown; details?: unknown };
        message = Array.isArray(b.message)
          ? b.message.join('; ')
          : typeof b.message === 'string'
            ? b.message
            : err.message;
        details = b.details;
      }
    } else if (
      err &&
      typeof err === 'object' &&
      typeof (err as { status?: unknown }).status === 'number' &&
      (err as { status: number }).status < 500
    ) {
      // Errors from the body parser: invalid JSON (400), body too large (413).
      status = (err as { status: number }).status;
      message =
        status === 413 ? 'Request body is too large.' : 'Request body is not valid JSON.';
    }

    if (status >= 500 && !(err instanceof HttpException)) {
      this.log.error(`${req.method} ${req.url} [${requestId}]`, (err as Error)?.stack ?? err);
    }

    res.status(status).json({
      error: {
        status,
        code: CODES[status] ?? (status >= 500 ? 'internal' : 'error'),
        message,
        requestId,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
