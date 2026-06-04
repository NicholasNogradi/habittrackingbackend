// Typed application errors that the error handler maps to RFC 7807 responses.

export class ApiError extends Error {
  constructor(status, title, detail, { type, errors, headers } = {}) {
    super(detail || title);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type || `https://errors.habittrack.io/${slug(title)}`;
    this.errors = errors;
    this.headers = headers; // optional response headers (e.g. WWW-Authenticate)
  }
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const BadRequest = (detail, errors) =>
  new ApiError(400, 'Bad Request', detail, { errors });

export const Unauthorized = (detail = 'Authentication credentials are missing or invalid.', opts = {}) =>
  new ApiError(401, 'Unauthorized', detail, {
    headers: { 'WWW-Authenticate': opts.challenge || 'Bearer realm="habittrack"' },
  });

export const Forbidden = (detail = 'You do not have permission to access this resource.') =>
  new ApiError(403, 'Forbidden', detail);

export const NotFound = (detail = 'The requested resource does not exist.') =>
  new ApiError(404, 'Not Found', detail);

export const Conflict = (detail) => new ApiError(409, 'Conflict', detail);

export const PreconditionFailed = (detail = 'The If-Match ETag does not match the current resource version.') =>
  new ApiError(412, 'Precondition Failed', detail);

export const UnprocessableEntity = (detail, errors) =>
  new ApiError(422, 'Unprocessable Entity', detail, { errors });

export const TooManyRequests = (detail = 'Rate limit exceeded.', retryAfter = 30) =>
  new ApiError(429, 'Too Many Requests', detail, {
    headers: { 'Retry-After': String(retryAfter) },
  });
