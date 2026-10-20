import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { MAX_UPLOAD_LABEL } from '../models/ArticleFile.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'That endpoint does not exist.'));
}

interface MongoLikeError {
  name?: string;
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies the error handler by arity — the 4th parameter must stay.
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Some of those details need another look.',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  // Multer rejects oversized uploads before the route runs; without this the
  // manager would just see "something went wrong".
  if ((err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    res.status(code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error:
        code === 'LIMIT_FILE_SIZE'
          ? `That file is larger than ${MAX_UPLOAD_LABEL}. Compress it or link to it instead.`
          : 'That upload could not be read. Attach a single PDF or PPTX file.',
    });
    return;
  }

  const mongoErr = err as MongoLikeError;

  if (mongoErr?.code === 11000) {
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? 'value';
    res.status(409).json({ error: `That ${field} is already in use.` });
    return;
  }

  if (mongoErr?.name === 'ValidationError' || mongoErr?.name === 'CastError') {
    res.status(422).json({ error: 'Some of those details need another look.' });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    error: 'Something went wrong on our end.',
    ...(env.isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
}

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
