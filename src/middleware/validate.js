import { UnprocessableEntity, BadRequest } from '../utils/errors.js';

/**
 * Validates a request part against a Zod schema.
 * @param {'body'|'query'|'params'} part
 * @param {import('zod').ZodType} schema
 * @param {object} opts { code: 400|422 } default 422 for body, 400 for query/params
 */
export function validate(part, schema, opts = {}) {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: '/' + issue.path.join('/'),
        message: issue.message,
        code: issue.code?.toUpperCase?.() || 'INVALID',
      }));
      const status = opts.code || (part === 'body' ? 422 : 400);
      const detail =
        status === 422
          ? 'The request body failed validation.'
          : `Invalid ${part} parameters.`;
      return next(status === 422 ? UnprocessableEntity(detail, errors) : BadRequest(detail, errors));
    }
    // Replace with parsed/coerced values. In Express 5 `req.query` is a
    // read-only getter, so mutate in place rather than reassigning.
    if (part === 'query') {
      for (const key of Object.keys(req.query)) delete req.query[key];
      Object.assign(req.query, result.data);
    } else {
      req[part] = result.data;
    }
    next();
  };
}

export const validateBody = (schema) => validate('body', schema, { code: 422 });
export const validateQuery = (schema) => validate('query', schema, { code: 400 });
export const validateParams = (schema) => validate('params', schema, { code: 400 });
