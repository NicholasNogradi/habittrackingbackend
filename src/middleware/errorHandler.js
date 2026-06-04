import crypto from 'node:crypto';
import { ApiError } from '../utils/errors.js';

// Converts thrown errors into RFC 7807 Problem Details responses.
export function errorHandler(err, req, res, _next) {
  const traceId = req.traceId || crypto.randomBytes(16).toString('hex');

  let apiErr = err;

  // Map known non-ApiError cases.
  if (!(err instanceof ApiError)) {
    // Sequelize unique constraint → 409
    if (err?.name === 'SequelizeUniqueConstraintError') {
      apiErr = new ApiError(409, 'Conflict', 'A resource with these values already exists.');
    } else if (err?.name === 'SequelizeValidationError') {
      apiErr = new ApiError(422, 'Unprocessable Entity', err.message);
    } else if (err?.type === 'entity.parse.failed') {
      apiErr = new ApiError(400, 'Bad Request', 'Request body is not valid JSON.');
    } else {
      // Unexpected → 500. Do not leak internals.
      if (process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.error('[unhandled]', traceId, err);
      }
      apiErr = new ApiError(500, 'Internal Server Error', 'An unexpected error occurred.');
    }
  }

  if (apiErr.headers) {
    for (const [k, v] of Object.entries(apiErr.headers)) res.setHeader(k, v);
  }

  res
    .status(apiErr.status)
    .type('application/json')
    .json({
      type: apiErr.type || 'about:blank',
      title: apiErr.title,
      status: apiErr.status,
      detail: apiErr.detail || apiErr.title,
      instance: req.originalUrl,
      traceId,
      ...(apiErr.errors ? { errors: apiErr.errors } : {}),
    });
}

// 404 fallback for unmatched routes.
export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, 'Not Found', `No route matches ${req.method} ${req.path}.`));
}
