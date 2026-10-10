import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type RequestSchema = z.ZodObject<{
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}>;

export const validate = (schema: RequestSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body ?? {},
      query: req.query,
      params: req.params,
    }) as { body?: unknown; query?: unknown; params?: unknown };

    if ('body' in schema.shape) req.body = parsed.body;
    if ('query' in schema.shape) req.query = parsed.query as Request['query'];
    if ('params' in schema.shape) req.params = parsed.params as Request['params'];

    next();
  };
};
