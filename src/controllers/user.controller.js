import { setETag, setLastModified, enforceIfMatch } from '../middleware/etag.js';

export async function getCurrentUser(req, res, next) {
  try {
    setETag(res, req.user);
    setLastModified(res, req.user);
    return res.status(200).json(req.user.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function updateCurrentUser(req, res, next) {
  try {
    enforceIfMatch(req, req.user);
    await req.user.update(req.body);
    setETag(res, req.user);
    return res.status(200).json(req.user.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function deleteCurrentUser(req, res, next) {
  try {
    await req.user.destroy();
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
