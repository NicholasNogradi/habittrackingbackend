import crypto from 'node:crypto';
import { PreconditionFailed } from '../utils/errors.js';

// Weak-ish strong ETag derived from the resource's id + updatedAt.
export function makeETag(resource) {
  const basis = `${resource.id}:${resource.updatedAt instanceof Date ? resource.updatedAt.toISOString() : resource.updatedAt}`;
  const hash = crypto.createHash('md5').update(basis).digest('hex');
  return `"${hash}"`;
}

export function setETag(res, resource) {
  res.setHeader('ETag', makeETag(resource));
}

export function setLastModified(res, resource) {
  const d = resource.updatedAt instanceof Date ? resource.updatedAt : new Date(resource.updatedAt);
  res.setHeader('Last-Modified', d.toUTCString());
}

/**
 * Enforces If-Match for mutating requests when the header is present.
 * If the client sends If-Match and it doesn't match, throw 412.
 */
export function enforceIfMatch(req, resource) {
  const ifMatch = req.get('if-match');
  if (!ifMatch) return; // Optional per spec.
  const current = makeETag(resource);
  // Support comma-separated list and the "*" wildcard.
  const tags = ifMatch.split(',').map((t) => t.trim());
  if (tags.includes('*')) return;
  if (!tags.includes(current)) {
    throw PreconditionFailed();
  }
}
